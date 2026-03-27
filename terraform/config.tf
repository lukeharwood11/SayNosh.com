terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "lukeharwood-dev-tfstate"
    key            = "prod/saynosh.com/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "lukeharwood-dev-tf-lock"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
