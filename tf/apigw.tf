resource "aws_api_gateway_account" "api_gateway_account" {
  cloudwatch_role_arn = aws_iam_role.cloudwatch.arn
}

resource "aws_cloudwatch_log_group" "pge_api_log_group" {
  name              = "API-Gateway-Execution-Logs_${aws_api_gateway_rest_api.pge_rest_api.id}/pge"
  retention_in_days = 14
}

data "aws_iam_policy_document" "api_gateway_global_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "cloudwatch" {
  name               = "api_gateway_cloudwatch_global"
  assume_role_policy = data.aws_iam_policy_document.api_gateway_global_assume_role.json
}

data "aws_iam_policy_document" "api_gateway_cloudwatch_logs" {
  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
      "logs:TestMetricFilter",
      "logs:DeleteLogGroup",
      "logs:DeleteLogStream",
      "logs:PutRetentionPolicy",
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cloudwatch" {
  name       = "cloudwatch_global"
  role       = aws_iam_role.cloudwatch.id
  policy     = data.aws_iam_policy_document.api_gateway_cloudwatch_logs.json
}

resource "aws_api_gateway_rest_api" "pge_rest_api" {
  name        = "pge-rest-api"
  description = "PGE REST API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "pge_resource_data" {
  rest_api_id = aws_api_gateway_rest_api.pge_rest_api.id
  parent_id   = aws_api_gateway_rest_api.pge_rest_api.root_resource_id
  path_part   = "data"
}

resource "aws_api_gateway_resource" "pge_resource_token" {
  rest_api_id = aws_api_gateway_rest_api.pge_rest_api.id
  parent_id   = aws_api_gateway_rest_api.pge_rest_api.root_resource_id
  path_part   = "token"
}

resource "aws_api_gateway_method" "pge_method_get" {
  rest_api_id   = aws_api_gateway_rest_api.pge_rest_api.id
  resource_id   = aws_api_gateway_resource.pge_resource_data.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "pge_method_post" {
  rest_api_id   = aws_api_gateway_rest_api.pge_rest_api.id
  resource_id   = aws_api_gateway_resource.pge_resource_token.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "pge_integration_get" {
  rest_api_id             = aws_api_gateway_rest_api.pge_rest_api.id
  resource_id             = aws_api_gateway_resource.pge_resource_data.id
  http_method             = aws_api_gateway_method.pge_method_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_function_with_docker_build_from_ecr.lambda_function_invoke_arn
}

resource "aws_api_gateway_integration" "pge_integration_post" {
  rest_api_id             = aws_api_gateway_rest_api.pge_rest_api.id
  resource_id             = aws_api_gateway_resource.pge_resource_token.id
  http_method             = aws_api_gateway_method.pge_method_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.lambda_function_with_docker_build_from_ecr.lambda_function_invoke_arn
}

resource "aws_api_gateway_deployment" "pge_deployment" {
  rest_api_id = aws_api_gateway_rest_api.pge_rest_api.id

  description = "PGE Deployment"
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_method.pge_method_post.id,
      aws_api_gateway_method.pge_method_get.id,
      aws_api_gateway_resource.pge_resource_token.id,
      aws_api_gateway_resource.pge_resource_data.id,
      aws_api_gateway_integration.pge_integration_post.id,
      aws_api_gateway_integration.pge_integration_get.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "pge_stage" {
  rest_api_id = aws_api_gateway_rest_api.pge_rest_api.id
  deployment_id = aws_api_gateway_deployment.pge_deployment.id
  stage_name  = "pge"

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.pge_api_log_group.arn
    format          = jsonencode({
      extendedRequestId = "$context.extendedRequestId",
      requestId = "$context.requestId",
      ip = "$context.identity.sourceIp",
      caller = "$context.identity.caller",
      user = "$context.identity.user",
      requestTime = "$context.requestTime",
      httpMethod = "$context.httpMethod",
      resourcePath = "$context.resourcePath",
      status = "$context.status",
      protocol = "$context.protocol",
      responseLength = "$context.responseLength",
      responseLatency = "$context.responseLatency",
    })
  }
  depends_on = [aws_cloudwatch_log_group.pge_api_log_group]
}
resource "aws_api_gateway_method_settings" "pge_method_settings" {
  rest_api_id = aws_api_gateway_rest_api.pge_rest_api.id
  stage_name = aws_api_gateway_stage.pge_stage.stage_name

  settings {
    logging_level = "INFO"
    data_trace_enabled = true
  }

  method_path = "*/*"
}

resource "aws_lambda_permission" "pge_lambda_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_function_with_docker_build_from_ecr.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.pge_rest_api.execution_arn}/*/*"
}
