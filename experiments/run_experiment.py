"""
semantic-complexity Phase α 실험 실행 스크립트

설계 원칙:
- 동일 input → 동일 model → 동일 output (temperature=0, seed 고정)
- 모든 요청/응답을 raw 그대로 저장 (편집 없음)
- 입력 코드의 SHA-256 해시를 기록하여 변조 감지
- API를 직접 호출 (oh-my-opencode/task() 우회 — 모델 통제를 위해)

사용법:
  source .venv/bin/activate
  python experiments/run_experiment.py --help
  python experiments/run_experiment.py \\
    --models gpt-5.4 sonnet-4.6 \\
    --inputs experiments/inputs/R1.json \\
    --output-dir experiments/results/v3
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# ─── 모델 레지스트리 ───────────────────────────────────────────────
# 각 모델의 API 호출 방법을 명시적으로 정의.
# 새 모델 추가 시 여기만 수정.

MODEL_REGISTRY = {
    "gpt-5.4": {
        "provider": "openai",
        "model_id": "gpt-5.4",
        "env_key": "OPENAI_API_KEY",
        "temperature": 0,
        "seed": 42,
        "max_tokens": 4096,
    },
    "sonnet-4.6": {
        "provider": "anthropic",
        "model_id": "claude-sonnet-4-20250514",
        "env_key": "ANTHROPIC_API_KEY",
        "temperature": 0,
        "max_tokens": 4096,
    },
    "opus-4.6": {
        "provider": "anthropic",
        "model_id": "claude-opus-4-20250514",
        "env_key": "ANTHROPIC_API_KEY",
        "temperature": 0,
        "max_tokens": 4096,
    },
    "gemini-3-pro": {
        "provider": "google",
        "model_id": "gemini-3-pro",
        "env_key": "GOOGLE_API_KEY",
        "temperature": 0,
        "max_tokens": 4096,
    },
    "gpt-5.4-mini": {
        "provider": "openai",
        "model_id": "gpt-5.4-mini",
        "env_key": "OPENAI_API_KEY",
        "temperature": 0,
        "seed": 42,
        "max_tokens": 4096,
    },
    "gpt-5.4-nano": {
        "provider": "openai",
        "model_id": "gpt-5.4-nano",
        "env_key": "OPENAI_API_KEY",
        "temperature": 0,
        "seed": 42,
        "max_tokens": 4096,
    },
    "haiku-3.5": {
        "provider": "anthropic",
        "model_id": "claude-3-5-haiku-20241022",
        "env_key": "ANTHROPIC_API_KEY",
        "temperature": 0,
        "max_tokens": 4096,
    },
    "gemini-flash": {
        "provider": "google",
        "model_id": "gemini-3-flash-preview",
        "env_key": "GOOGLE_API_KEY",
        "temperature": 0,
        "max_tokens": 4096,
    },
}


# ─── API 호출 함수 ─────────────────────────────────────────────────


def call_openai(model_config: dict, prompt: str) -> dict:
    """OpenAI API 직접 호출. temperature=0, seed 고정."""
    from openai import OpenAI

    client = OpenAI(api_key=os.environ[model_config["env_key"]])
    start = time.monotonic()
    response = client.chat.completions.create(
        model=model_config["model_id"],
        messages=[{"role": "user", "content": prompt}],
        temperature=model_config["temperature"],
        seed=model_config.get("seed"),
        max_completion_tokens=model_config["max_tokens"],
    )
    elapsed = time.monotonic() - start

    usage = response.usage
    return {
        "model_id_requested": model_config["model_id"],
        "model_id_actual": response.model,
        "content": response.choices[0].message.content,
        "finish_reason": response.choices[0].finish_reason,
        "usage": {
            "prompt_tokens": usage.prompt_tokens if usage else 0,
            "completion_tokens": usage.completion_tokens if usage else 0,
            "total_tokens": usage.total_tokens if usage else 0,
        },
        "system_fingerprint": getattr(response, "system_fingerprint", None),
        "response_id": response.id,
        "elapsed_seconds": round(elapsed, 2),
    }


def call_anthropic(model_config: dict, prompt: str) -> dict:
    """Anthropic API 직접 호출. temperature=0."""
    import anthropic

    client = anthropic.Anthropic(api_key=os.environ[model_config["env_key"]])
    start = time.monotonic()
    response = client.messages.create(
        model=model_config["model_id"],
        max_tokens=model_config["max_tokens"],
        temperature=model_config["temperature"],
        messages=[{"role": "user", "content": prompt}],
    )
    elapsed = time.monotonic() - start

    return {
        "model_id_requested": model_config["model_id"],
        "model_id_actual": response.model,
        "content": response.content[0].text
        if hasattr(response.content[0], "text")
        else str(response.content[0]),
        "finish_reason": response.stop_reason,
        "usage": {
            "prompt_tokens": response.usage.input_tokens,
            "completion_tokens": response.usage.output_tokens,
            "total_tokens": response.usage.input_tokens + response.usage.output_tokens,
        },
        "response_id": response.id,
        "elapsed_seconds": round(elapsed, 2),
    }


def call_google(model_config: dict, prompt: str) -> dict:
    """Google GenAI API 직접 호출. temperature=0."""
    from google import genai

    client = genai.Client(api_key=os.environ[model_config["env_key"]])
    start = time.monotonic()
    response = client.models.generate_content(
        model=model_config["model_id"],
        contents=prompt,
        config={
            "temperature": model_config["temperature"],
            "max_output_tokens": model_config["max_tokens"],
        },
    )
    elapsed = time.monotonic() - start

    return {
        "model_id_requested": model_config["model_id"],
        "model_id_actual": model_config["model_id"],
        "content": response.text,
        "finish_reason": str(response.candidates[0].finish_reason)
        if response.candidates
        else "unknown",
        "usage": {
            "prompt_tokens": getattr(response.usage_metadata, "prompt_token_count", 0),
            "completion_tokens": getattr(
                response.usage_metadata, "candidates_token_count", 0
            ),
            "total_tokens": getattr(response.usage_metadata, "total_token_count", 0),
        },
        "response_id": None,
        "elapsed_seconds": round(elapsed, 2),
    }


PROVIDER_DISPATCH = {
    "openai": call_openai,
    "anthropic": call_anthropic,
    "google": call_google,
}


# ─── 유틸리티 ──────────────────────────────────────────────────────


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_input(input_path: Path) -> dict:
    """실험 입력 JSON을 로드하고 검증한다.

    입력 파일 형식:
    {
      "experiment_id": "bread-R1",
      "repo": "nsidnev/fastapi-realworld-example-app",
      "commit": "029eb778...",
      "file": "app/api/routes/authentication.py",
      "lines": "1-93",
      "code": "...(전체 코드)...",
      "prompts": {
        "A": "Analyze the security of the following code...\n```python\n{code}\n```",
        "C": "Analyze the security...\nUse the following checklist:\n- B1:...\n```python\n{code}\n```"
      }
    }
    """
    with open(input_path) as f:
        data = json.load(f)

    required = ["experiment_id", "repo", "commit", "file", "lines", "code", "prompts"]
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"입력 파일에 필수 필드 누락: {missing}")

    data["code_sha256"] = sha256(data["code"])
    return data


def build_prompt(template: str, code: str) -> str:
    """프롬프트 템플릿에 코드를 삽입한다."""
    return template.replace("{code}", code)


def run_single(model_name: str, prompt: str, prompt_group: str) -> dict:
    """단일 실험 단위를 실행하고 결과를 반환한다."""
    if model_name not in MODEL_REGISTRY:
        raise ValueError(
            f"미등록 모델: {model_name}. 등록된 모델: {list(MODEL_REGISTRY.keys())}"
        )

    config = MODEL_REGISTRY[model_name]

    if config["env_key"] not in os.environ:
        raise EnvironmentError(
            f"{config['env_key']}가 .env에 없습니다. 모델 {model_name} 실행 불가."
        )

    prompt_sha256 = sha256(prompt)
    call_fn = PROVIDER_DISPATCH[config["provider"]]
    api_result = call_fn(config, prompt)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_name": model_name,
        "prompt_group": prompt_group,
        "prompt_sha256": prompt_sha256,
        "prompt_token_count": api_result["usage"]["prompt_tokens"],
        "config": {
            "model_id": config["model_id"],
            "provider": config["provider"],
            "temperature": config["temperature"],
            "seed": config.get("seed"),
            "max_tokens": config["max_tokens"],
        },
        "response": api_result,
    }


# ─── 메인 실행 ─────────────────────────────────────────────────────


def run_experiment(
    input_path: Path,
    models: list[str],
    output_dir: Path,
    groups: list[str] | None = None,
    dry_run: bool = False,
):
    """실험을 실행하고 결과를 저장한다."""
    data = load_input(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    experiment_id = data["experiment_id"]
    available_groups = list(data["prompts"].keys())
    groups = groups or available_groups

    print(f"실험: {experiment_id}")
    print(f"레포: {data['repo']}@{data['commit']}")
    print(f"파일: {data['file']} L{data['lines']}")
    print(f"코드 SHA-256: {data['code_sha256']}")
    print(f"모델: {models}")
    print(f"그룹: {groups}")
    print(f"총 단위: {len(models) * len(groups)}")
    print(f"출력: {output_dir}")
    print("---")

    if dry_run:
        print("[DRY RUN] 실제 API 호출 없이 종료.")
        return

    results = []
    for model_name in models:
        for group in groups:
            if group not in data["prompts"]:
                print(f"[SKIP] 그룹 '{group}'이 입력에 없음")
                continue

            prompt = build_prompt(data["prompts"][group], data["code"])
            unit_id = f"{experiment_id}_{model_name}_{group}"
            print(f"[RUN] {unit_id} ... ", end="", flush=True)

            try:
                result = run_single(model_name, prompt, group)
                result["experiment_id"] = experiment_id
                result["unit_id"] = unit_id
                result["input"] = {
                    "repo": data["repo"],
                    "commit": data["commit"],
                    "file": data["file"],
                    "lines": data["lines"],
                    "code_sha256": data["code_sha256"],
                }

                result_path = output_dir / f"{unit_id}.json"
                with open(result_path, "w") as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)

                response_path = output_dir / f"{unit_id}.response.md"
                with open(response_path, "w") as f:
                    f.write(f"# {unit_id}\n\n")
                    f.write(f"- model: {result['config']['model_id']}\n")
                    f.write(
                        f"- model_actual: {result['response']['model_id_actual']}\n"
                    )
                    f.write(f"- timestamp: {result['timestamp']}\n")
                    f.write(f"- temperature: {result['config']['temperature']}\n")
                    f.write(f"- seed: {result['config'].get('seed', 'N/A')}\n")
                    f.write(f"- prompt_sha256: {result['prompt_sha256']}\n")
                    f.write(f"- tokens: {result['response']['usage']}\n")
                    f.write(f"- elapsed: {result['response']['elapsed_seconds']}s\n\n")
                    f.write("---\n\n")
                    f.write(result["response"]["content"])

                elapsed = result["response"]["elapsed_seconds"]
                tokens = result["response"]["usage"]["total_tokens"]
                print(f"OK ({elapsed}s, {tokens} tokens)")
                results.append(result)

            except Exception as e:
                print(f"FAIL: {e}")
                error_path = output_dir / f"{unit_id}.error.json"
                with open(error_path, "w") as f:
                    json.dump(
                        {
                            "unit_id": unit_id,
                            "error": str(e),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                        f,
                        indent=2,
                    )

    summary_path = output_dir / f"{experiment_id}_summary.json"
    with open(summary_path, "w") as f:
        json.dump(
            {
                "experiment_id": experiment_id,
                "input_file": str(input_path),
                "code_sha256": data["code_sha256"],
                "models": models,
                "groups": groups,
                "total_units": len(models) * len(groups),
                "completed": len(results),
                "results": [
                    {
                        "unit_id": r["unit_id"],
                        "model": r["model_name"],
                        "group": r["prompt_group"],
                        "tokens": r["response"]["usage"]["total_tokens"],
                        "elapsed": r["response"]["elapsed_seconds"],
                        "prompt_sha256": r["prompt_sha256"],
                    }
                    for r in results
                ],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    print("---")
    print(f"완료: {len(results)}/{len(models) * len(groups)}")
    print(f"요약: {summary_path}")


def main():
    parser = argparse.ArgumentParser(
        description="semantic-complexity 실험 실행기",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  # 전체 실행
  python experiments/run_experiment.py \\
    --models gpt-5.4 sonnet-4.6 \\
    --inputs experiments/inputs/bread_R1.json \\
    --output-dir experiments/results/v3

  # dry run (API 호출 없이 설정 확인)
  python experiments/run_experiment.py \\
    --models gpt-5.4 \\
    --inputs experiments/inputs/bread_R1.json \\
    --dry-run

  # 특정 그룹만
  python experiments/run_experiment.py \\
    --models gpt-5.4 sonnet-4.6 \\
    --inputs experiments/inputs/bread_R1.json \\
    --groups A C

등록된 모델: gpt-5.4, sonnet-4.6, opus-4.6, gemini-3-pro
        """,
    )
    parser.add_argument(
        "--models",
        nargs="+",
        required=True,
        help="실험할 모델 이름 (예: gpt-5.4 sonnet-4.6)",
    )
    parser.add_argument(
        "--inputs", type=Path, required=True, help="입력 JSON 파일 경로"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("experiments/results"),
        help="결과 저장 디렉토리",
    )
    parser.add_argument(
        "--groups",
        nargs="+",
        default=None,
        help="실행할 프롬프트 그룹 (기본: 입력 파일의 모든 그룹)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="API 호출 없이 설정만 확인"
    )

    args = parser.parse_args()

    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f".env 로드: {env_path}")
    else:
        print(f"[WARN] .env 없음: {env_path} — 환경변수에서 직접 읽음")

    for m in args.models:
        if m not in MODEL_REGISTRY:
            parser.error(
                f"미등록 모델: {m}. 등록된 모델: {list(MODEL_REGISTRY.keys())}"
            )

    run_experiment(
        input_path=args.inputs,
        models=args.models,
        output_dir=args.output_dir,
        groups=args.groups,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
