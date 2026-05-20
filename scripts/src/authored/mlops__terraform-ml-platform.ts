/**
 * Phase 7 — Wave 1a / mlops-engineer (advanced).
 * Candidate 49204556-683d-4ad7-b0e9-167f8b3cf212 — Terraform-Provisioned ML Platform (71.1).
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const mlopsTerraformMlPlatform: AuthoredProject = {
  slug: "mlops-terraform-ml-platform",
  title: "Terraform-Provisioned ML Platform — EKS + S3 + MLflow + IAM",
  shortDescription:
    "Stand up a reproducible ML platform with Terraform: EKS cluster, S3 artifact store, RDS metadata store, MLflow tracking server, IAM IRSA roles, and a multi-env state-backend layout. Push a button → environment exists; tear-down is one command.",
  fullDescription:
    "Click-ops ML platforms are how teams end up with one 'dev' cluster that's actually three different versions across regions. The 2026 production pattern is everything-as-code: Terraform owns the EKS cluster, the S3 model registry bucket, the MLflow Postgres metadata DB, the IAM IRSA roles, and the state backend itself. You'll author the modules, wire a multi-env (dev/stage/prod) folder layout with separate workspaces, and add a `terraform plan` GitHub Actions check on PR.",
  language: "python",
  difficulty: "advanced",
  techStack: ["Python", "Terraform", "Kubernetes", "Docker", "MLflow", "aws"],
  tags: ["terraform", "mlops", "kubernetes", "mlflow", "aws", "iam", "infrastructure-as-code"],
  learningObjectives: [
    "Author Terraform modules for EKS, S3, RDS, and IRSA roles instead of click-ops.",
    "Lay out a multi-environment (dev/stage/prod) state-backend with workspace separation.",
    "Wire EKS IRSA so pods get scoped IAM credentials without long-lived secrets.",
    "Deploy MLflow tracking server on EKS backed by RDS + S3 via Helm + Terraform.",
    "Gate every change on a `terraform plan` GitHub Actions check.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "ML team is one click-ops outage away from losing track of which cluster is canonical. Move the entire platform under Terraform with multi-env separation.",
    hiringRelevance2026:
      "Every senior MLOps JD asks for Terraform + Kubernetes + IRSA + multi-env state layout. This project hits all four with code you can paste into an interview screenshare.",
    readmeOutline: [
      "Overview", "Module layout", "Step 1 state backend", "Step 2 EKS module",
      "Step 3 IRSA + S3 + RDS", "Step 4 MLflow Helm release", "Step 5 plan CI",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "GitHub repo with a complete Terraform layout (modules/, envs/dev|stage|prod), a `make plan-dev` target, a GitHub Actions workflow that runs `terraform validate + plan` on every PR, and a README walking through 'spin up dev in 12 minutes'.",
    portfolioRelevance:
      "Senior MLOps interviewers want to see end-to-end IaC — not 'I wrote the EKS module' alone. A multi-env layout with PR-gated plans + IRSA + MLflow is the full stack.",
    repoUrl: "https://github.com/<your-handle>/tf-ml-platform",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Multi-env state backend (S3 + DynamoDB lock)",
      instructionMd:
        "Author `modules/state-backend/main.tf` that provisions the S3 bucket + DynamoDB lock table used by all OTHER environments. Each env (dev/stage/prod) gets its own state key under the same bucket: `envs/dev/terraform.tfstate`. Use bucket versioning + server-side encryption. Validator runs `terraform validate` + parses the resulting plan JSON and asserts (a) bucket has versioning enabled, (b) DynamoDB table has the LockID hash key.",
      learningObjective: "Bootstrap the IaC state backend itself with IaC so disaster recovery is just `terraform apply`.",
      requiredSkill: "Terraform S3 backend + DynamoDB lock table + bucket versioning",
      starterCode: SRC(`# modules/state-backend/main.tf
resource "aws_s3_bucket" "tfstate" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  # TODO: versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      # TODO: sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  # TODO: hash_key = "LockID" + attribute { name = "LockID", type = "S" }
}
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "`terraform validate` succeeds; bucket has Versioning=Enabled + SSE; DynamoDB table has hash_key=LockID type=S.", {
        expectedVersioning: "Enabled",
        expectedSse: "AES256",
        expectedHashKey: "LockID",
      }),
      expectedOutputs: { versioning: "Enabled", sse: "AES256", lockKey: "LockID" },
      datasetRefs: ["fixtures/state_backend_expected.tfplan.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Versioning is required because Terraform sometimes corrupts state on apply errors — versioning lets you roll back.",
          "DynamoDB lock prevents two engineers running `apply` against the same state simultaneously and corrupting it.",
          "versioning_configuration { status = \"Enabled\" }",
          "hash_key = \"LockID\"; attribute { name = \"LockID\"; type = \"S\" }",
          "(see hints above)",
        ],
        successFeedback: "State backend live. Every other env's tfstate is now versioned + lock-protected.",
        failureFeedback: "Common slips: forgot DynamoDB lock (two devs apply concurrently → state corruption); forgot versioning (a bad apply that corrupts state is now unrecoverable).",
        portfolioRelevance: "Senior MLOps interviewers ask 'how do you protect your tfstate?'. Versioning + lock + IaC for the backend itself is the full answer.",
        finalExplanation: "Bootstrapping the state backend with IaC means disaster recovery is `terraform apply` against a local backend, then re-import. Without IaC for the backend, you're click-ops-ing the foundation.",
        misconceptionToWatchFor: "Storing tfstate in a local file or in a git repo. Local: every team member's apply diverges. Git: secrets leak into commits.",
      }),
    },
    {
      stepNumber: 2,
      title: "EKS cluster module with managed node groups",
      instructionMd:
        "Author `modules/eks/main.tf` provisioning an EKS cluster + a managed node group + the OIDC provider needed for IRSA. Use the official `terraform-aws-modules/eks/aws` module v20+ — building from scratch is multi-thousand-line YAML. Inputs: cluster_name, vpc_id, subnet_ids, node_instance_types. Outputs: cluster_endpoint, oidc_provider_arn. Validator runs `terraform validate` + asserts the OIDC provider output is wired so step 3 can consume it.",
      learningObjective: "Provision an EKS cluster with OIDC for IRSA using the community-standard EKS module.",
      requiredSkill: "Terraform module composition + EKS OIDC + node group sizing",
      starterCode: SRC(`# modules/eks/main.tf
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.30"
  vpc_id          = var.vpc_id
  subnet_ids      = var.subnet_ids

  # TODO: enable IRSA via enable_irsa = true
  # TODO: managed node group "ml" with instance_types = var.node_instance_types,
  #       min/desired/max = 2/3/8.
}

output "cluster_endpoint" { value = module.eks.cluster_endpoint }
output "oidc_provider_arn" { value = module.eks.oidc_provider_arn }
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "validate succeeds; module config has enable_irsa=true; ml node group has desired_size=3.", {
        expectedIrsa: true,
        expectedNodeGroupName: "ml",
        expectedDesiredSize: 3,
      }),
      expectedOutputs: { irsa: true, nodeGroup: "ml", desired: 3 },
      datasetRefs: ["fixtures/eks_module_expected.tfplan.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "enable_irsa = true is mandatory if any pod needs to assume an IAM role.",
          "eks_managed_node_groups = { ml = { instance_types = var.node_instance_types, min_size=2, desired_size=3, max_size=8 } }",
          "Pin the module version — `~> 20.0` accepts 20.x but not 21.x. Floating versions break reproducibility.",
          "Outputs forward cluster_endpoint + oidc_provider_arn for downstream modules.",
          "(see hints above)",
        ],
        successFeedback: "EKS module ships. Pods can now authenticate to AWS without baked-in keys (via IRSA in the next step).",
        failureFeedback: "Common slips: didn't enable IRSA (IRSA setup in step 3 fails); pinned to a major version that drifted from the docs; sized the node group too small (MLflow + workloads OOM).",
        portfolioRelevance: "Showing `terraform-aws-modules/eks/aws` + IRSA + pinned version signals you've shipped real EKS — not just done the AWS console tutorial.",
        finalExplanation: "Community modules absorb thousands of lines of YAML maintenance. Pinning to a major version range (`~> 20.0`) gets bugfixes without breaking changes.",
        misconceptionToWatchFor: "Writing the cluster from scratch with raw aws_eks_cluster + aws_eks_node_group resources. Works, but you're now maintaining a few thousand lines of YAML.",
      }),
    },
    {
      stepNumber: 3,
      title: "S3 + RDS + IRSA role for MLflow",
      instructionMd:
        "Author `modules/mlflow-deps/main.tf`: an S3 bucket for model artifacts, a PostgreSQL RDS for MLflow metadata, and an IAM role + IRSA trust policy so the `mlflow` ServiceAccount in the `mlflow` namespace can read/write the bucket WITHOUT long-lived keys. IRSA = IAM Roles for Service Accounts; the trust policy condition keys are `oidc-provider:sub` matching `system:serviceaccount:mlflow:mlflow`. Validator runs `terraform validate` + asserts the role's assume-role policy has the right condition.",
      learningObjective: "Wire IRSA so pods get scoped, short-lived AWS credentials via OIDC instead of static IAM users.",
      requiredSkill: "IAM trust policies + OIDC + IRSA + RDS/S3 module composition",
      starterCode: SRC(`# modules/mlflow-deps/main.tf
resource "aws_s3_bucket" "models" {
  bucket = "${var.env}-ml-models"
}

resource "aws_db_instance" "mlflow" {
  identifier        = "${var.env}-mlflow"
  engine            = "postgres"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  # ... other required attrs elided for brevity (use module if preferred)
  username = "mlflow"
  password = var.mlflow_db_password   # via secrets manager in prod
  skip_final_snapshot = true
}

data "aws_iam_policy_document" "mlflow_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "\${replace(var.oidc_provider_arn, \"/^.*oidc-provider///\", \"\")}:sub"
      # TODO: values = ["system:serviceaccount:mlflow:mlflow"]
    }
  }
}

resource "aws_iam_role" "mlflow" {
  name               = "${var.env}-mlflow-irsa"
  assume_role_policy = data.aws_iam_policy_document.mlflow_trust.json
}

# TODO: attach a policy allowing s3:GetObject/PutObject/ListBucket on aws_s3_bucket.models.arn.
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "Trust policy has StringEquals on oidc-provider:sub = 'system:serviceaccount:mlflow:mlflow'; role has policy granting s3 RW on the bucket.", {
        expectedTrustSub: "system:serviceaccount:mlflow:mlflow",
        expectedS3Actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      }),
      expectedOutputs: { trustSub: "system:serviceaccount:mlflow:mlflow", s3Actions: 3 },
      datasetRefs: ["fixtures/mlflow_deps_expected.tfplan.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "IRSA's whole point: the OIDC condition matches a Kubernetes ServiceAccount, so pods using that SA can assume the role.",
          "values = [\"system:serviceaccount:mlflow:mlflow\"]  # namespace:serviceaccount",
          "The S3 policy: GetObject + PutObject + ListBucket on bucket-arn and bucket-arn/*.",
          "DON'T put RDS credentials in plain Terraform vars — wire AWS Secrets Manager. The starter uses a var for clarity but flag it as TODO in the README.",
          "(see hints above)",
        ],
        successFeedback: "MLflow's namespace gets scoped S3 access via short-lived OIDC tokens. No static keys anywhere.",
        failureFeedback: "Common slips: condition typo'd as :aud instead of :sub (silently broken); attached a wildcard policy (least-privilege violation); committed the RDS password to the repo.",
        portfolioRelevance: "IRSA fluency is one of the top senior-MLOps interview filters. Most candidates know 'service accounts' generically — IRSA specifically is the AWS-on-Kubernetes answer.",
        finalExplanation: "IRSA is how mature shops avoid static AWS keys on pods. The OIDC federation turns 'I am SA mlflow:mlflow' into 'here is a 1-hour STS token for the mlflow role'. Static keys leak; STS tokens expire.",
        misconceptionToWatchFor: "Using kiam / kube2iam. Those were the pre-IRSA pattern and are deprecated; IRSA is the AWS-native answer.",
      }),
    },
    {
      stepNumber: 4,
      title: "MLflow Helm release wired to S3 + RDS",
      instructionMd:
        "Use the `helm_release` resource to install MLflow (or the bitnami/mlflow chart) on EKS. Wire the chart values: backendStoreUri=`postgresql://mlflow:...@<rds-endpoint>/mlflow`, artifactRoot=`s3://<env>-ml-models/mlflow/`, serviceAccount.annotations[`eks.amazonaws.com/role-arn`]=role-arn-from-step-3. Validator runs `terraform validate` + asserts the SA annotation contains the IRSA role ARN.",
      learningObjective: "Install MLflow on the EKS cluster with backend store + artifact store + IRSA annotation.",
      requiredSkill: "Terraform helm_release + Helm values templating + IRSA SA annotation",
      starterCode: SRC(`# modules/mlflow-app/main.tf
resource "helm_release" "mlflow" {
  name       = "mlflow"
  namespace  = "mlflow"
  create_namespace = true
  repository = "https://community-charts.github.io/helm-charts"
  chart      = "mlflow"
  version    = "0.7.19"

  values = [yamlencode({
    backendStore = {
      postgres = {
        host = var.rds_host
        # ... credentials wired
      }
    }
    artifactRoot = {
      s3 = {
        bucket = var.artifact_bucket
        path   = "mlflow/"
      }
    }
    serviceAccount = {
      create = true
      name   = "mlflow"
      # TODO: annotations = { "eks.amazonaws.com/role-arn" = var.irsa_role_arn }
    }
  })]
}
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "helm_release.mlflow has serviceAccount.annotations with eks.amazonaws.com/role-arn = the IRSA role from step 3.", {
        expectedAnnotationKey: "eks.amazonaws.com/role-arn",
      }),
      expectedOutputs: { irsaAnnotationPresent: true },
      datasetRefs: ["fixtures/mlflow_release_expected.tfplan.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "The IRSA wiring is purely the SA annotation; the role itself comes from step 3.",
          "annotations = { \"eks.amazonaws.com/role-arn\" = var.irsa_role_arn }",
          "Pin chart version; floating versions break reproducibility the same way as module versions.",
          "Wire RDS credentials via Kubernetes Secret + valueFrom secretKeyRef, not in plain values.",
          "(see hints above)",
        ],
        successFeedback: "MLflow live on EKS with S3 artifacts + RDS metadata + IRSA-scoped credentials.",
        failureFeedback: "Common slips: forgot the SA annotation (pods can't assume role → S3 writes fail mysteriously); RDS creds in plain text values (leak via `helm get values`).",
        portfolioRelevance: "Showing a Helm release wired into IRSA + RDS + S3 is the prod recipe most candidates have never put together end-to-end.",
        finalExplanation: "helm_release lets Terraform own the Kubernetes-side resources too — so `terraform destroy` truly destroys everything. Mixing Helm + kubectl is how state drifts.",
        misconceptionToWatchFor: "Running `helm install` manually after `terraform apply`. Now the cluster state isn't in tfstate; tear-down leaves orphans.",
      }),
    },
    {
      stepNumber: 5,
      title: "GitHub Actions: terraform plan on every PR",
      instructionMd:
        "Write `.github/workflows/tf-plan.yml` running `terraform init && terraform validate && terraform plan -out=plan.bin` for each env on every PR. Use OIDC federation to AWS (no long-lived keys in repo secrets) via `aws-actions/configure-aws-credentials` with `role-to-assume`. Post the plan summary as a sticky PR comment. Validator parses the workflow YAML and asserts (a) job triggers on pull_request, (b) AWS auth uses OIDC, (c) at least three jobs (one per env).",
      learningObjective: "Gate every Terraform change behind a CI plan + OIDC auth to AWS.",
      requiredSkill: "GitHub Actions OIDC + matrix strategy + Terraform plan diff",
      starterCode: SRC(`# .github/workflows/tf-plan.yml
name: tf-plan
on: pull_request

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  plan:
    strategy:
      matrix:
        env: [dev, stage, prod]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          # TODO: role-to-assume = secrets.AWS_ROLE_ARN_FOR_TF
          aws-region: us-east-1
      - uses: hashicorp/setup-terraform@v3
      - run: terraform -chdir=envs/\${{ matrix.env }} init
      - run: terraform -chdir=envs/\${{ matrix.env }} validate
      - run: terraform -chdir=envs/\${{ matrix.env }} plan -out=plan.bin
`),
      validationType: "exact",
      stepType: "multi_file",
      validation: validationConfig("exact", "Workflow runs on pull_request; permissions.id-token=write; matrix has dev/stage/prod; role-to-assume present.", {
        triggers: ["pull_request"],
        expectedMatrix: ["dev", "stage", "prod"],
        expectedAuthMethod: "oidc",
      }),
      expectedOutputs: { trigger: "pull_request", envs: 3, auth: "oidc" },
      datasetRefs: ["fixtures/tf_plan_workflow_expected.yml"],
      pedagogy: pedagogyConfig({
        hints: [
          "OIDC federation needs `permissions: id-token: write` on the job + `role-to-assume` configured in AWS to trust the GitHub OIDC provider.",
          "role-to-assume: \\${{ secrets.AWS_ROLE_ARN_FOR_TF }}",
          "Matrix over envs so every env's plan runs in parallel; failure in one doesn't mask the others.",
          "Post the plan diff as a sticky PR comment with a community action so reviewers see what's changing.",
          "(see hints above)",
        ],
        successFeedback: "Every PR now produces a per-env plan in the CI logs. No more 'I applied a thing and it broke prod'.",
        failureFeedback: "Common slips: used long-lived AWS keys in GH secrets (OIDC is the 2026 right answer); forgot id-token: write (OIDC silently doesn't work); ran plan but not validate (validate catches schema errors a plan would also catch but later).",
        portfolioRelevance: "OIDC federation to AWS in CI is a 2026 senior-MLOps hire signal. Every recruiter scanning for 'IaC at scale' knows this is the pattern.",
        finalExplanation: "Plan-on-PR turns 'I think this change is safe' into a reviewable artifact. Combined with OIDC auth, no long-lived AWS keys live in your repo or your CI vault.",
        misconceptionToWatchFor: "Using `terraform apply -auto-approve` in CI on every PR. That's a recipe for prod outages. Plan in CI; apply manually (or via a protected branch + apply pipeline).",
      }),
    },
  ],
};
