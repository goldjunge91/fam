#!/usr/bin/env python3
import json
import os
import sys
import tempfile


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def fasttext_run(payload: dict) -> list[dict]:
    try:
        import fasttext
    except ImportError:
        fail("fasttext fehlt in der ML-Python-Umgebung.")
    with tempfile.TemporaryDirectory(prefix="category-fasttext-") as temp_dir:
        train_path = os.path.join(temp_dir, "train.txt")
        with open(train_path, "w", encoding="utf-8") as handle:
            for row in payload["train"]:
                text = row["text"].replace("\n", " ")
                handle.write(f"__label__{row['classId']} {text}\n")
        model = fasttext.train_supervised(
            input=train_path,
            epoch=35,
            lr=0.35,
            wordNgrams=2,
            minn=3,
            maxn=5,
            dim=80,
            loss="softmax",
            thread=max(1, min(4, os.cpu_count() or 1)),
            verbose=0,
        )
        result = []
        for row in payload["test"]:
            labels, scores = model.predict(row["text"].replace("\n", " "), k=1)
            result.append({"label_id": row["label_id"], "category_id": labels[0].removeprefix("__label__"), "confidence": float(scores[0])})
        return result


def setfit_run(payload: dict) -> list[dict]:
    try:
        from datasets import Dataset
        from setfit import SetFitModel, Trainer, TrainingArguments
    except ImportError:
        fail("setfit oder datasets fehlt in der ML-Python-Umgebung.")
    model_name = os.environ.get("SETFIT_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    labels = payload["classes"]
    model = SetFitModel.from_pretrained(model_name, labels=labels)
    dataset = Dataset.from_dict({
        "text": [row["text"] for row in payload["train"]],
        "label": [labels.index(row["classId"]) for row in payload["train"]],
    })
    trainer = Trainer(
        model=model,
        args=TrainingArguments(batch_size=16, num_epochs=(1, 12), seed=42, show_progress_bar=False),
        train_dataset=dataset,
    )
    trainer.train()
    probabilities = model.predict_proba([row["text"] for row in payload["test"]])
    if hasattr(probabilities, "cpu"):
        probabilities = probabilities.cpu().numpy()
    predictions = probabilities.argmax(axis=1)
    return [
        {"label_id": row["label_id"], "category_id": labels[int(prediction)], "confidence": float(probabilities[position, int(prediction)])}
        for position, (row, prediction) in enumerate(zip(payload["test"], predictions))
    ]


def siglip_run(payload: dict) -> list[dict]:
    try:
        import numpy as np
        from PIL import Image
        from sklearn.linear_model import LogisticRegression
        from transformers import AutoModel, AutoProcessor
        import torch
    except ImportError:
        fail("torch, transformers, scikit-learn oder Pillow fehlt in der ML-Python-Umgebung.")
    model_name = os.environ.get("SIGLIP_MODEL", "google/siglip2-base-patch16-224")
    processor = AutoProcessor.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name).eval()

    def embed(rows: list[dict]) -> np.ndarray:
        vectors = []
        with torch.no_grad():
            for row in rows:
                text_inputs = processor(text=[row["text"]], padding="max_length", return_tensors="pt")
                text_vector = model.get_text_features(**text_inputs)[0].cpu().numpy()
                if row.get("imagePath"):
                    with Image.open(row["imagePath"]) as source:
                        image = source.convert("RGB")
                        image_inputs = processor(images=[image], return_tensors="pt")
                    image_vector = model.get_image_features(**image_inputs)[0].cpu().numpy()
                    has_image = 1.0
                else:
                    image_vector = np.zeros_like(text_vector)
                    has_image = 0.0
                vectors.append(np.concatenate([text_vector, image_vector, np.array([has_image], dtype=np.float32)]))
        return np.stack(vectors)

    classifier = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)
    classifier.fit(embed(payload["train"]), [row["classId"] for row in payload["train"]])
    probabilities = classifier.predict_proba(embed(payload["test"]))
    indices = probabilities.argmax(axis=1)
    return [
        {"label_id": row["label_id"], "category_id": str(classifier.classes_[index]), "confidence": float(probabilities[pos, index])}
        for pos, (row, index) in enumerate(zip(payload["test"], indices))
    ]


def main() -> None:
    if len(sys.argv) != 2:
        fail("Aufruf: train-baseline.py fasttext|setfit|siglip")
    payload = json.load(sys.stdin)
    method = sys.argv[1]
    runners = {"fasttext": fasttext_run, "setfit": setfit_run, "siglip": siglip_run}
    if method not in runners:
        fail(f"Unbekannte Baseline: {method}")
    json.dump(runners[method](payload), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
