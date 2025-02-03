data "aws_region" "current" {}

data "aws_caller_identity" "this" {}

data "aws_ecr_authorization_token" "token" {}

locals {
  source_path   = "../"
  path_include  = ["src/**", "Dockerfile", "package.json"]
  path_exclude  = ["**/__tests__/**", "dist/**", "node_modules/**", "**/.git/**", "**/.vscode/**", "tf/**", "jest.config.js", "data.json", "data/**"]
  files_include = setunion([for f in local.path_include : fileset(local.source_path, f)]...)
  files_exclude = setunion([for f in local.path_exclude : fileset(local.source_path, f)]...)
  files         = sort(setsubtract(local.files_include, local.files_exclude))

  dir_sha = sha1(join("", [for f in local.files : filesha1("${local.source_path}/${f}")]))
}

provider "aws" {
  region = "us-east-1"

  # Make it faster by skipping something
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_credentials_validation = true
}

provider "docker" {
  registry_auth {
    address  = format("%v.dkr.ecr.%v.amazonaws.com", data.aws_caller_identity.this.account_id, data.aws_region.current.name)
    username = data.aws_ecr_authorization_token.token.user_name
    password = data.aws_ecr_authorization_token.token.password
  }
}

resource "aws_s3_bucket" "pge_data_bucket" {
  bucket = "pge-data-bucket"
}

resource "aws_s3_bucket_versioning" "pge_s3_versioning" {
  bucket = aws_s3_bucket.pge_data_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "pge_s3_bucket_public_access_block" {
  bucket = aws_s3_bucket.pge_data_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "lambda_function_with_docker_build_from_ecr" {
  source = "terraform-aws-modules/lambda/aws"

  function_name = "pge-lambda-with-docker-build-from-ecr"
  description   = "PGE Test"

  create_package = false

  ##################
  # Container Image
  ##################
  package_type  = "Image"
  architectures = ["x86_64"]

  image_uri = module.docker_build_from_ecr.image_uri
}

module "docker_build_from_ecr" {
  source = "./modules/docker-build"

  ecr_repo = module.ecr.repository_name

  use_image_tag = true
  image_tag   = "pge-v1"

  source_path = local.source_path
  platform    = "linux/amd64"
  build_args = {
    provenance = false
  }

  triggers = {
    dir_sha = local.dir_sha
  }

  cache_from = ["${module.ecr.repository_url}:latest"]
}

module "ecr" {
  source = "terraform-aws-modules/ecr/aws"

  repository_name         = "pge-ecr"
  repository_force_delete = true

  create_lifecycle_policy = false

  repository_lambda_read_access_arns = [module.lambda_function_with_docker_build_from_ecr.lambda_function_arn]
}

data "aws_iam_policy_document" "pge_data_bucket_policy" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.pge_data_bucket.arn, "${aws_s3_bucket.pge_data_bucket.arn}/*"]
  }
}

data "aws_iam_role" "pge_lambda_role" {
  name = module.lambda_function_with_docker_build_from_ecr.lambda_role_name
}

resource "aws_iam_policy" "pge_data_bucket_policy" {
  name        = "pge_data_bucket_policy"
  description = "Policy for PGE data bucket"
  policy      = data.aws_iam_policy_document.pge_data_bucket_policy.json
}

resource "aws_iam_policy_attachment" "pge_data_bucket_policy_attachment" {
  name       = "pge_data_bucket_policy_attachment"
  policy_arn = aws_iam_policy.pge_data_bucket_policy.arn
  roles      = [data.aws_iam_role.pge_lambda_role.name]
}
