locals {
  tags = {
    AppName     = "nosh"
    AppWebsite  = "saynosh.com"
    Environment = "Production"
    Owner       = "Luke Harwood"
  }

  app_name        = "nosh"
  domain_name     = "saynosh.com"
  region          = "us-east-1"
  spa_bucket_name = "saynosh.com"
}
