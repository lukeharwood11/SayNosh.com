resource "aws_s3_bucket" "spa_bucket" {
  bucket = local.spa_bucket_name
}

resource "aws_s3_bucket_server_side_encryption_configuration" "spa_bucket" {
  bucket = aws_s3_bucket.spa_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "spa_bucket" {
  bucket = aws_s3_bucket.spa_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "null_resource" "spa_bucket_file_upload" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-lc"]
    command     = <<-EOT
      set -euo pipefail

      dist_dir="${abspath("${path.module}/../web/dist")}" 
      if [ ! -f "$dist_dir/index.html" ]; then
        echo "Missing built frontend at $dist_dir. Run 'npm --prefix ../web run build' first."
        exit 1
      fi

      tmpdir="$(mktemp -d)"
      trap 'rm -rf "$tmpdir"' EXIT

      cp -R "$dist_dir/." "$tmpdir/"

      aws s3 sync "$tmpdir/" "s3://${aws_s3_bucket.spa_bucket.id}" --delete
      aws cloudfront create-invalidation --distribution-id "${aws_cloudfront_distribution.spa_distribution.id}" --paths '/*'
    EOT
  }

  depends_on = [
    aws_s3_bucket_policy.spa_bucket_policy,
    aws_cloudfront_distribution.spa_distribution,
  ]
}
