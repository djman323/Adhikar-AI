import asyncio
import os

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import PromptTemplate
from langchain_huggingface import HuggingFaceEndpoint

try:
    asyncio.get_running_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

DB_FAISS_PATH = "vectorstore/db_faiss"

def get_vectorstore():
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local(DB_FAISS_PATH, embedding_model, allow_dangerous_deserialization=True)
    return db

def set_custom_prompt(custom_prompt_template):
    return PromptTemplate(template=custom_prompt_template, input_variables=["context", "question"])

def load_llm(huggingface_repo_id):
    HF_TOKEN = os.getenv("HF_TOKEN")
    if not HF_TOKEN:
        raise ValueError("Error: Hugging Face API token not found. Set HF_TOKEN in environment variables.")

    return HuggingFaceEndpoint(
        repo_id=huggingface_repo_id,
        temperature=0.5,
        model_kwargs={"token": HF_TOKEN, "max_length": "512"}
    )

def main():
    print("Welcome to the Chatbot! Type your question below:")

    CUSTOM_PROMPT_TEMPLATE = """
        Use the pieces of information provided in the context to answer the user's question.
        If you don't know the answer, just say that you don't know. Don't try to make up an answer. 
        Don't provide anything out of the given context.

        Context: {context}
        Question: {question}

        Start the answer directly. No small talk, please.
    """

    HUGGINGFACE_REPO_ID = "mistralai/Mistral-7B-Instruct-v0.3"

    try:
        vectorstore = get_vectorstore()
        if vectorstore is None:
            print("Error: Failed to load the vector store.")
            return

        qa_chain = RetrievalQA.from_chain_type(
            llm=load_llm(huggingface_repo_id=HUGGINGFACE_REPO_ID),
            chain_type="stuff",
            retriever=vectorstore.as_retriever(search_kwargs={'k': 3}),
            return_source_documents=True,
            chain_type_kwargs={'prompt': set_custom_prompt(CUSTOM_PROMPT_TEMPLATE)}
        )

        while True:
            prompt = input("\nYou: ")
            if prompt.lower() in ["exit", "quit"]:
                print("Goodbye!")
                break

            response = qa_chain.invoke({'query': prompt})

            result = response["result"]
            source_documents = response["source_documents"]
            print("\nChatbot:", result)
            print("Source Docs:", source_documents)

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()