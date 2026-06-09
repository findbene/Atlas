/**
 * Phase 7 — Wave 1c / data-scientist (advanced).
 * Candidate e376cd0d-a945-43f5-8ec9-3edade7fd5f5 — PyTorch Image Fine-Tuning.
 */
import {
  pedagogyConfig, validationConfig, portfolioArtifact, projectMeta,
  type AuthoredProject,
} from "@workspace/curriculum-quality";

const SRC = (s: string) => s;

export const dataScientistPytorchImageFinetuning: AuthoredProject = {
  slug: "data-scientist-pytorch-image-finetuning",
  candidateId: "e376cd0d-a945-43f5-8ec9-3edade7fd5f5",
  title: "PyTorch Image Fine-Tuning with HuggingFace + MLflow Tracking",
  shortDescription:
    "Fine-tune a HuggingFace pretrained vision model (ViT) on a custom image dataset with PyTorch DataLoader + AMP mixed precision, track every run in MLflow, save the best checkpoint by val accuracy, and produce an evaluation report with per-class metrics.",
  fullDescription:
    "Fine-tuning a pretrained vision model is the 2026 baseline for any image-classification task at a real company. You'll build the proper training pipeline: HuggingFace AutoImageProcessor + AutoModelForImageClassification, PyTorch DataLoader with proper transforms + augmentation, AMP mixed-precision training (2-3x speedup on GPU with no accuracy loss), MLflow run logging + parent/child runs for hyperparameter sweeps, best-checkpoint saving by val accuracy, and a per-class precision/recall report.",
  language: "python",
  difficulty: "advanced",
  techStack: ["PyTorch", "HuggingFace", "Python", "MLflow"],
  tags: ["pytorch", "huggingface", "mlflow", "fine-tuning", "vision", "data-scientist", "amp"],
  learningObjectives: [
    "Load a HuggingFace pretrained vision model and configure its classification head for a custom label set.",
    "Build a PyTorch DataLoader with train/val augmentation transforms.",
    "Implement an AMP mixed-precision training loop with autocast + GradScaler.",
    "Track every epoch in MLflow with metrics + parameters + the best checkpoint as an artifact.",
    "Produce a per-class precision/recall report on the validation set.",
  ],
  estimatedMinutes: 220,
  xpReward: 700,
  isMultiFile: true,
  meta: projectMeta({
    scenario:
      "Marketplace team needs an image classifier for 8 product categories. The baseline ResNet-from-scratch model on 5k images plateaus at 71%. Switch to fine-tuning a pretrained ViT to push past 90%.",
    hiringRelevance2026:
      "Fine-tuning a HuggingFace vision model is the 2026 data-scientist baseline. AMP + MLflow + per-class metrics is what separates production DS from notebook DS.",
    readmeOutline: [
      "Overview & Scenario", "Architecture (HF model → PyTorch → MLflow)",
      "Step 1 model + processor", "Step 2 DataLoader + transforms",
      "Step 3 AMP training loop", "Step 4 MLflow checkpoints",
      "Step 5 per-class report", "Portfolio Hand-off",
    ],
  }),
  portfolio: portfolioArtifact({
    kind: "repo",
    deliverable:
      "Public GitHub repo with the fine-tuning script, MLflow tracking server config, per-class report notebook, the best checkpoint .pt, validation accuracy curve, and a writeup of the 71% → 92% jump.",
    portfolioRelevance:
      "Fine-tuning + AMP + MLflow + per-class report is the senior-DS combo. The 71% → 92% accuracy story is the kind of narrative hiring managers remember.",
    repoUrl: "https://github.com/<your-handle>/pytorch-image-finetuning",
  }),
  steps: [
    {
      stepNumber: 1,
      title: "Load pretrained ViT + adapt classification head",
      instructionMd:
        "Load `google/vit-base-patch16-224` via `AutoModelForImageClassification.from_pretrained(name, num_labels=8, ignore_mismatched_sizes=True)`. The `ignore_mismatched_sizes=True` lets you replace the 1000-way ImageNet head with an 8-way head for our categories. Get the matching `AutoImageProcessor` for input normalization. Validator asserts model.classifier.out_features == 8 + processor.image_mean is set.",
      learningObjective: "Configure a pretrained HuggingFace vision model with a custom classification head.",
      requiredSkill: "HuggingFace AutoModel + classification head adaptation + AutoImageProcessor",
      starterCode: SRC(`# model.py
from transformers import AutoModelForImageClassification, AutoImageProcessor

LABELS = ["shirt", "pants", "dress", "shoes", "bag", "watch", "hat", "jewelry"]
MODEL_NAME = "google/vit-base-patch16-224"

def build_model():
    processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    # TODO:
    # model = AutoModelForImageClassification.from_pretrained(
    #     MODEL_NAME,
    #     num_labels=len(LABELS),
    #     id2label={i: l for i, l in enumerate(LABELS)},
    #     label2id={l: i for i, l in enumerate(LABELS)},
    #     ignore_mismatched_sizes=True,
    # )
    # return model, processor
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "build_model() returns (model, processor) without error. model.classifier.out_features == 8 (one output per LABELS entry). processor.image_mean is a list of 3 floats (the ViT normalisation constants).",
      }),
      expectedOutputs: { outFeatures: 8, meanLen: 3 },
      datasetRefs: ["fixtures/model_config_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "ViT = Vision Transformer. patch16 = 16x16 input patches. 224 = input image side length.",
          "ignore_mismatched_sizes is the key flag — without it, loading fails because the 1000-way head doesn't match.",
          "Always set id2label + label2id so MLflow + HF Hub renders predictions with human labels.",
          "model = AutoModelForImageClassification.from_pretrained(MODEL_NAME, num_labels=len(LABELS), id2label=..., label2id=..., ignore_mismatched_sizes=True)",
          "(see reference above)",
        ],
        successFeedback: "Model loaded with the right head shape. Ready for fine-tuning.",
        failureFeedback: "Common slips: forgot ignore_mismatched_sizes (load fails); used the processor without normalization (model returns garbage).",
        portfolioRelevance: "HuggingFace fine-tuning is the 2026 DS default. Replacing the classification head correctly is the most-asked interview detail.",
        finalExplanation: "Pretrained vision models give you 80% of the way there for free. The last 20% comes from your data + a properly-configured head.",
        misconceptionToWatchFor: "Training from scratch. With <100k images you'll always lose to a fine-tuned pretrained model.",
      }),
    },
    {
      stepNumber: 2,
      title: "DataLoader with train/val transforms",
      instructionMd:
        "Build `train_loader` + `val_loader` from torchvision.datasets.ImageFolder. Train transforms: RandomResizedCrop(224), RandomHorizontalFlip, ColorJitter, Normalize(processor.image_mean, processor.image_std). Val transforms: Resize(256), CenterCrop(224), Normalize. Use num_workers=4, pin_memory=True. Validator builds both loaders against a fixture dir + asserts batch shape (B, 3, 224, 224) + label dtype int64.",
      learningObjective: "Build a PyTorch DataLoader with appropriate train vs val transforms.",
      requiredSkill: "torchvision transforms + ImageFolder + DataLoader num_workers/pin_memory tuning",
      starterCode: SRC(`# data.py
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

def loaders(data_dir: str, processor, batch_size: int = 32):
    mean, std = processor.image_mean, processor.image_std
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])
    val_tf = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=mean, std=std),
    ])
    train_ds = datasets.ImageFolder(f"{data_dir}/train", transform=train_tf)
    val_ds   = datasets.ImageFolder(f"{data_dir}/val",   transform=val_tf)
    # TODO: train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=4, pin_memory=True)
    # TODO: val_loader   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True)
    raise NotImplementedError
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "next(iter(train_loader)) returns (images, labels) where images.shape == (32, 3, 224, 224) and labels.dtype == torch.int64. Val loader uses deterministic CenterCrop (no random augmentation).",
      }),
      expectedOutputs: { batchShape: [32, 3, 224, 224] },
      datasetRefs: ["fixtures/imagefolder_sample"],
      pedagogy: pedagogyConfig({
        hints: [
          "Train transforms = augmentation (random crop, flip, jitter). Val transforms = deterministic (center crop) so val accuracy is stable.",
          "Normalize MUST use the processor's mean/std — using ImageNet defaults instead is the #1 'why is my val acc bad' bug.",
          "num_workers=4 + pin_memory=True is the standard 'fast loader' combo on a single GPU.",
          "train_loader = DataLoader(train_ds, batch_size=32, shuffle=True, num_workers=4, pin_memory=True, persistent_workers=True)",
          "(see reference above)",
        ],
        successFeedback: "Loaders ship. Training can begin.",
        failureFeedback: "Common slips: applied train transforms to val (val acc jumps around → wrong best-checkpoint selection); skipped Normalize (model sees raw pixel values it wasn't trained on).",
        portfolioRelevance: "Knowing the train/val transform asymmetry is a senior-DS sign. Most candidates accidentally augment val.",
        finalExplanation: "Augmentation expands your effective training set + reduces overfitting. Val transforms must stay deterministic.",
        misconceptionToWatchFor: "Skipping augmentation 'because the dataset is big enough'. You'll overfit even on 100k images without it.",
      }),
    },
    {
      stepNumber: 3,
      title: "AMP mixed-precision training loop",
      instructionMd:
        "Implement the train loop using `torch.amp.autocast(device_type='cuda', dtype=torch.float16)` + `torch.amp.GradScaler()`. The pattern: with autocast, forward + loss; scaler.scale(loss).backward(); scaler.step(optimizer); scaler.update(). This is 2-3x faster on GPU with no accuracy loss. Validator runs 1 epoch on a tiny fixture dataset + asserts loss decreased + no NaN.",
      learningObjective: "Train with AMP mixed precision for 2-3x throughput without accuracy degradation.",
      requiredSkill: "torch.amp.autocast + GradScaler + scaler.scale/step/update protocol",
      starterCode: SRC(`# train.py
import torch
from torch.amp import autocast, GradScaler

def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    scaler = GradScaler(device=str(device))
    total_loss = 0.0
    for images, labels in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)
        # TODO:
        # with autocast(device_type='cuda', dtype=torch.float16):
        #     out = model(pixel_values=images).logits
        #     loss = criterion(out, labels)
        # scaler.scale(loss).backward()
        # scaler.step(optimizer)
        # scaler.update()
        total_loss += loss.item()
    return total_loss / len(loader)
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "After 1 epoch on the tiny fixture (32 images, 4 classes), train_one_epoch returns a loss that is lower than the initial loss before any gradient steps. No parameter in the model contains NaN after training.",
      }),
      expectedOutputs: { lossDecreased: true, noNaN: true },
      datasetRefs: ["fixtures/tiny_train_set"],
      pedagogy: pedagogyConfig({
        hints: [
          "Mixed precision: fp16 for matrix ops, fp32 for accumulation. GradScaler protects against fp16 underflow.",
          "set_to_none=True on zero_grad is the modern fast path (vs. setting to zero tensors).",
          "non_blocking=True on .to(device) lets the H2D transfer overlap with the previous batch's compute.",
          "scaler.scale(loss).backward(); scaler.step(optimizer); scaler.update() — three-line ritual, do not skip update.",
          "(see reference above)",
        ],
        successFeedback: "Training loop is 2-3x faster. Same gradients, half the time.",
        failureFeedback: "Common slips: forgot scaler.update() (gradient scale never adjusts → all NaN after a few steps); used .backward() without scaler.scale (fp16 gradients vanish to 0).",
        portfolioRelevance: "AMP is the standard 2026 PyTorch training pattern. Recruiters expect every modern DS to know it.",
        finalExplanation: "AMP gives you fp32 numerical stability with fp16 throughput. It's almost free; use it always on GPU.",
        misconceptionToWatchFor: "Skipping AMP because 'the model is small enough'. Even for small models, AMP is 2x faster on Tensor Cores.",
      }),
    },
    {
      stepNumber: 4,
      title: "MLflow tracking + best-checkpoint artifact",
      instructionMd:
        "Wrap the training loop in `mlflow.start_run()`. Log `mlflow.log_params({lr, batch_size, epochs})` once, `mlflow.log_metrics({'train_loss': l, 'val_acc': a}, step=epoch)` per epoch. Save the model only when val_acc improves: `mlflow.pytorch.log_model(model, 'best')`. Validator runs 2 epochs (artificially: epoch 1 has higher val_acc) + asserts only ONE artifact is logged (the better one).",
      learningObjective: "Track training runs in MLflow + save only the best checkpoint by val accuracy.",
      requiredSkill: "mlflow.start_run + log_params + log_metrics + log_model + best-checkpoint pattern",
      starterCode: SRC(`# trainer.py
import mlflow, mlflow.pytorch

def train(model, train_loader, val_loader, optimizer, criterion, device, epochs, lr, batch_size):
    mlflow.set_tracking_uri("http://mlflow:5000")
    mlflow.set_experiment("vit-finetune")
    with mlflow.start_run():
        mlflow.log_params({"lr": lr, "batch_size": batch_size, "epochs": epochs, "model": "vit-base-patch16-224"})
        best_acc = 0.0
        for epoch in range(epochs):
            train_loss = train_one_epoch(model, train_loader, optimizer, criterion, device)
            val_acc = evaluate(model, val_loader, device)
            mlflow.log_metrics({"train_loss": train_loss, "val_acc": val_acc}, step=epoch)
            # TODO: if val_acc > best_acc: best_acc = val_acc; mlflow.pytorch.log_model(model, "best")
    return best_acc
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "After training for 2 epochs (fixture val_acc: epoch 1 = 0.70, epoch 2 = 0.65): MLflow run has lr/batch_size/epochs/model params logged, train_loss and val_acc metrics logged at step 0 and step 1, and exactly 1 'best' model artifact corresponding to epoch 1 (the higher val_acc).",
      }),
      expectedOutputs: { metricSteps: 2, artifacts: 1 },
      datasetRefs: ["fixtures/mlflow_run_expected.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "step= keyword in log_metrics gives MLflow the x-axis for time-series plots.",
          "Save best by val_acc, not by train loss — train loss decreases monotonically but val acc is the actual generalization signal.",
          "log_model overwrites the 'best' artifact each time — so the final file = the highest val_acc.",
          "if val_acc > best_acc: best_acc = val_acc; mlflow.pytorch.log_model(model, 'best')",
          "(see reference above)",
        ],
        successFeedback: "Every run is now reproducible + comparable. MLflow UI shows train_loss + val_acc curves.",
        failureFeedback: "Common slips: logged the final model instead of best (overfit late-epoch model wins); logged every epoch's model (artifact bloat).",
        portfolioRelevance: "MLflow + best-checkpoint logging is THE production-DS pattern. Hiring managers see it and know you ship.",
        finalExplanation: "Run-level tracking + best-checkpoint saving is the foundation of reproducible DS. Without it, every fine-tune is a one-shot.",
        misconceptionToWatchFor: "Tracking via TensorBoard alone. Tensorboard is fine for plots; it doesn't manage models, params, or artifacts.",
      }),
    },
    {
      stepNumber: 5,
      title: "Per-class precision/recall report",
      instructionMd:
        "On the validation set, compute per-class precision + recall + F1 + support via `sklearn.metrics.classification_report(y_true, y_pred, target_names=LABELS, output_dict=True)`. Log it as JSON via `mlflow.log_dict(report, 'classification_report.json')`. Validator runs the report against fixture predictions + asserts 8 class entries + 'accuracy' key + 'weighted avg' key.",
      learningObjective: "Produce + log a per-class metrics report so model weaknesses are visible.",
      requiredSkill: "sklearn.metrics.classification_report + per-class metrics interpretation + mlflow.log_dict",
      starterCode: SRC(`# evaluate.py
import torch
from sklearn.metrics import classification_report
import mlflow

def per_class_report(model, val_loader, device, labels: list[str]) -> dict:
    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for images, targets in val_loader:
            images = images.to(device, non_blocking=True)
            logits = model(pixel_values=images).logits
            preds = logits.argmax(dim=-1).cpu().numpy()
            y_true.extend(targets.numpy().tolist())
            y_pred.extend(preds.tolist())
    report = classification_report(y_true, y_pred, target_names=labels, output_dict=True)
    # TODO: mlflow.log_dict(report, 'classification_report.json')
    return report
`),
      validationType: "self_attest",
      stepType: "code_python",
      validation: validationConfig("self_attest", "This is a learner attestation — Atlas does not run your code or grade this; verify it yourself against the criteria.", {
        attestationCriteria: "per_class_report returns a dict with 8 class entries (one per LABELS item, each containing precision, recall, f1-score, support), an 'accuracy' float, a 'macro avg' entry, and a 'weighted avg' entry. The report is also logged to MLflow as 'classification_report.json'.",
      }),
      expectedOutputs: { classes: 8, hasAccuracy: true },
      datasetRefs: ["fixtures/val_preds_for_report.json"],
      pedagogy: pedagogyConfig({
        hints: [
          "Per-class metrics surface 'we have 92% accuracy but recall on shoes is 50%' — the kind of insight aggregate accuracy hides.",
          "output_dict=True returns a structured object; output_dict=False returns the printable table.",
          "log_dict serializes JSON to the run's artifact store — viewable in MLflow UI.",
          "import json, mlflow; mlflow.log_dict(report, 'classification_report.json')",
          "(see reference above)",
        ],
        successFeedback: "Per-class report lands as an MLflow artifact. The team can spot the weak class + iterate.",
        failureFeedback: "Common slips: skipped target_names (report shows class IDs, not labels — useless); used .cpu() inside the loop (slow), should be at extend time.",
        portfolioRelevance: "Per-class metrics + a story about iterating on the weakest class is a recruiter green-flag. Aggregate accuracy is the bootcamp tell.",
        finalExplanation: "Aggregate accuracy lies. Per-class metrics tell the truth + drive the next experiment.",
        misconceptionToWatchFor: "Reporting only accuracy on an imbalanced dataset. You can hit 90% by predicting the majority class always.",
      }),
    },
  ],
};
