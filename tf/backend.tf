terraform {
  backend "s3" {
    bucket         = "pge-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "pge-terraform-state-lock"
    encrypt        = true
  }
}