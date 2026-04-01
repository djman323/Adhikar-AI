import uuid

import requests


def main() -> None:
    session_id = str(uuid.uuid4())[:8]
    print("Adhikar AI CLI")
    print(f"Session: {session_id}")
    print("Type your question about Indian constitutional law. Type 'exit' to quit.")

    while True:
        prompt = input("\nYou: ").strip()
        if prompt.lower() in {"exit", "quit"}:
            print("Goodbye!")
            break

        if not prompt:
            continue

        try:
            response = requests.post(
                "http://127.0.0.1:5000/chat",
                json={"query": prompt, "session_id": session_id},
                timeout=120,
            )
            response.raise_for_status()
            payload = response.json()

            print("\nAdhikar AI:", payload.get("response", ""))
            print("Sources:")
            for src in payload.get("sources", []):
                print(
                    f"- [Source {src.get('source_id')}] {src.get('section_hint')} "
                    f"(page {src.get('page')})"
                )
        except Exception as exc:
            print(f"Error: {exc}")


if __name__ == "__main__":
    main()