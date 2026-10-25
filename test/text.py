from docx import Document
import json
import sys
from pathlib import Path


def extract_text_from_docx(input_file, output_file):
    doc = Document(input_file)

    data = {
        "source_file": Path(input_file).name,
        "paragraphs": []
    }

    for i, paragraph in enumerate(doc.paragraphs):
        text = paragraph.text.strip()

        if text:
            data["paragraphs"].append({
                "id": i + 1,
                "text": text
            })

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"Extracted {len(data['paragraphs'])} paragraphs.")
    print(f"Saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python extract.py input.docx output.json")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]

    extract_text_from_docx(input_file, output_file)
    