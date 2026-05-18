from pathlib import Path
import PyPDF2
import docx


def extract_text(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()

    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    elif ext == ".pdf":
        text = ""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        return text

    elif ext == ".docx":
        doc = docx.Document(file_path)
        return "\n".join([p.text for p in doc.paragraphs])

    else:
        raise ValueError(f"Unsupported file type: {ext}")


def chunk_text(text: str, chunk_size=1000, overlap=200):
    chunks = []

    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    return chunks


async def ingest_sop_file(file_path: str, rag_service):
    text = extract_text(file_path)

    if not text.strip():
        return 0

    chunks = chunk_text(text)

    documents = []
    metadatas = []
    ids = []

    import uuid

    for chunk in chunks:
        documents.append(chunk)
        metadatas.append({
            "source": Path(file_path).name,
            "type": "sop"
        })
        ids.append(str(uuid.uuid4()))

    embeddings = rag_service._embed_model.encode(documents).tolist()

    rag_service._collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
        embeddings=embeddings
    )

    return len(chunks)