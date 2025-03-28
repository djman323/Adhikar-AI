import asyncio
import os
from flask import Flask, request, jsonify
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_huggingface import HuggingFaceEndpoint

try:
    asyncio.get_running_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

app = Flask(__name__)

DB_FAISS_PATH = "vectorstore/db_faiss"
HUGGINGFACE_REPO_ID = "mistralai/Mistral-7B-Instruct-v0.3"
HF_TOKEN = os.getenv("HF_TOKEN")  # Use environment variable for token security

CUSTOM_PROMPT_TEMPLATE = """
    Use the pieces of information provided in the context to answer the user's question.
    If you don't know the answer, just say that you don't know. Don't try to make up an answer.
    Don't provide anything out of the given context.

    Context: {context}
    Question: {question}

    Start the answer directly. No small talk, please.
"""

def get_vectorstore():
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local(DB_FAISS_PATH, embedding_model, allow_dangerous_deserialization=True)
    return db

def set_custom_prompt(custom_prompt_template):
    return PromptTemplate(template=custom_prompt_template, input_variables=["context", "question"])

def load_llm():
    return HuggingFaceEndpoint(
        repo_id=HUGGINGFACE_REPO_ID,
        temperature=0.5,
        model_kwargs={"token": HF_TOKEN, "max_length": "512"}
    )

vectorstore = get_vectorstore()
retriever = vectorstore.as_retriever(search_kwargs={'k': 3})
qa_chain = RetrievalQA.from_chain_type(
    llm=load_llm(),
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True,
    chain_type_kwargs={'prompt': set_custom_prompt(CUSTOM_PROMPT_TEMPLATE)}
)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_query = data.get("query")
    if not user_query:
        return jsonify({"error": "Query parameter is missing"}), 400
    
    try:
        response = qa_chain.invoke({'query': user_query})
        result = response["result"]
        source_documents = response["source_documents"]
        return jsonify({"response": result, "sources": [doc.metadata for doc in source_documents]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)