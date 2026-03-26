"""
세션 기반 실험 실행기 — Anthropic 모델 전용

Claude 세션을 모델로 사용하여 실험을 실행한다.
ANTHROPIC_API_KEY 없이 현재 Claude 세션에서 직접 실험 가능.

워크플로우:
  Step 1. prepare  — 입력 JSON에서 프롬프트 파일 생성
  Step 2. (Claude가 각 .prompt.md를 읽고 .response.md로 저장)
  Step 3. package  — 응답 파일을 표준 실험 결과 형식으로 패키징

사용 예시:
  # Step 1
  python experiments/run_session.py prepare \\
    --inputs experiments/inputs/cheese_R4.json \\
    --models sonnet-4.6 opus-4.6 \\
    --groups B D \\
    --output-dir experiments/results/session/cheese-R4

  # Step 3 (Step 2는 Claude가 수행)
  python experiments/run_session.py package \\
    --session-dir experiments/results/session/cheese-R4

세션 모델 레지스트리:
  sonnet-4.6  → claude-sonnet-4-6
  opus-4.6    → claude-opus-4-6
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── 세션 모델 레지스트리 ─────────────────────────────────────────
SESSION_MODELS = {
    "sonnet-4.6": {
        "model_id": "claude-sonnet-4-6",
        "provider": "anthropic-session",
        "temperature": 0,
        "note": "Claude 세션에서 직접 실행 (API key 불필요)",
    },
    "opus-4.6": {
        "model_id": "claude-opus-4-6",
        "provider": "anthropic-session",
        "temperature": 0,
        "note": "Claude 세션에서 직접 실행 (API key 불필요)",
    },
}


# ─── 유틸리티 ──────────────────────────────────────────────────────

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_input(input_path: Path) -> dict:
    with open(input_path) as f:
        data = json.load(f)
    required = ["experiment_id", "repo", "commit", "file", "lines", "code", "prompts"]
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"입력 파일에 필수 필드 누락: {missing}")
    data["code_sha256"] = sha256(data["code"])
    return data


def build_prompt(template: str, code: str) -> str:
    return template.replace("{code}", code)


def unit_id(experiment_id: str, model_name: str, group: str) -> str:
    return f"{experiment_id}_{model_name}_{group}"


# ─── STEP 1: prepare ──────────────────────────────────────────────

def cmd_prepare(args):
    """
    입력 JSON에서 프롬프트 파일을 생성한다.
    Claude가 각 파일을 읽고 .response.md로 저장하면 Step 3로 진행.
    """
    data = load_input(Path(args.inputs))
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    models = args.models
    groups = args.groups or list(data["prompts"].keys())

    # 유효성 검사
    for m in models:
        if m not in SESSION_MODELS:
            print(f"[ERROR] 미등록 세션 모델: {m}. 등록된 모델: {list(SESSION_MODELS.keys())}")
            sys.exit(1)
    for g in groups:
        if g not in data["prompts"]:
            print(f"[ERROR] 그룹 '{g}'이 입력에 없음. 사용 가능: {list(data['prompts'].keys())}")
            sys.exit(1)

    manifest = {
        "experiment_id": data["experiment_id"],
        "repo": data["repo"],
        "commit": data["commit"],
        "file": data["file"],
        "lines": data["lines"],
        "code_sha256": data["code_sha256"],
        "models": models,
        "groups": groups,
        "units": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    print(f"\n{'='*60}")
    print(f"실험: {data['experiment_id']}")
    print(f"레포: {data['repo']}@{data['commit']}")
    print(f"코드 SHA-256: {data['code_sha256']}")
    print(f"출력 디렉토리: {out_dir}")
    print(f"{'='*60}\n")

    for model_name in models:
        model_cfg = SESSION_MODELS[model_name]
        for group in groups:
            uid = unit_id(data["experiment_id"], model_name, group)
            prompt = build_prompt(data["prompts"][group], data["code"])
            prompt_sha = sha256(prompt)

            # 프롬프트 파일 저장
            prompt_file = out_dir / f"{uid}.prompt.md"
            with open(prompt_file, "w") as f:
                f.write(f"# {uid}\n\n")
                f.write(f"<!-- meta\n")
                f.write(f"experiment_id: {data['experiment_id']}\n")
                f.write(f"model_name: {model_name}\n")
                f.write(f"model_id: {model_cfg['model_id']}\n")
                f.write(f"group: {group}\n")
                f.write(f"prompt_sha256: {prompt_sha}\n")
                f.write(f"code_sha256: {data['code_sha256']}\n")
                f.write(f"repo: {data['repo']}\n")
                f.write(f"commit: {data['commit']}\n")
                f.write(f"file: {data['file']}\n")
                f.write(f"lines: {data['lines']}\n")
                f.write(f"-->\n\n")
                f.write(f"## 프롬프트\n\n")
                f.write(prompt)
                f.write(f"\n\n---\n\n")
                f.write(f"## Claude 응답\n\n")
                f.write(f"<!-- Claude가 여기에 응답을 작성 -->\n")

            manifest["units"].append({
                "unit_id": uid,
                "model_name": model_name,
                "model_id": model_cfg["model_id"],
                "group": group,
                "prompt_sha256": prompt_sha,
                "prompt_file": str(prompt_file),
                "response_file": str(out_dir / f"{uid}.response.md"),
                "status": "pending",
            })

            print(f"[PREPARED] {uid}")
            print(f"           → {prompt_file}")

    # 매니페스트 저장
    manifest_file = out_dir / "manifest.json"
    with open(manifest_file, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    total = len(models) * len(groups)
    print(f"\n총 {total}개 프롬프트 파일 생성 완료.")
    print(f"매니페스트: {manifest_file}")
    print(f"\n[NEXT STEP] Claude가 각 .prompt.md를 읽고 응답 후:")
    print(f"  python experiments/run_session.py package --session-dir {out_dir}")


# ─── STEP 3: package ──────────────────────────────────────────────

def cmd_package(args):
    """
    Claude가 작성한 .response.md 파일들을 표준 실험 결과 형식으로 패키징한다.
    run_experiment.py와 동일한 .json + .response.md 구조로 저장.
    """
    session_dir = Path(args.session_dir)
    manifest_file = session_dir / "manifest.json"

    if not manifest_file.exists():
        print(f"[ERROR] manifest.json 없음: {manifest_file}")
        print("  먼저 'prepare' 명령을 실행하세요.")
        sys.exit(1)

    with open(manifest_file) as f:
        manifest = json.load(f)

    out_dir = Path(args.output_dir) if args.output_dir else session_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    skipped = []

    for unit in manifest["units"]:
        uid = unit["unit_id"]
        response_file = Path(unit["response_file"])

        # .response.md 파일 확인
        if not response_file.exists():
            print(f"[SKIP] {uid} — 응답 파일 없음: {response_file}")
            skipped.append(uid)
            continue

        response_text = response_file.read_text()

        # 메타 주석에서 응답 본문만 추출
        # "## Claude 응답" 이후의 텍스트
        match = re.search(r"## Claude 응답\n\n(.+)", response_text, re.DOTALL)
        if match:
            content = match.group(1).strip()
            # 매직 주석 제거
            content = re.sub(r"<!-- Claude가 여기에 응답을 작성 -->\n?", "", content).strip()
        else:
            content = response_text  # 전체를 응답으로 취급

        if not content:
            print(f"[SKIP] {uid} — 응답 내용 없음 (Claude가 아직 응답하지 않음)")
            skipped.append(uid)
            continue

        timestamp = datetime.now(timezone.utc).isoformat()

        # 표준 결과 JSON 생성 (run_experiment.py와 동일 구조)
        result = {
            "timestamp": timestamp,
            "model_name": unit["model_name"],
            "prompt_group": unit["group"],
            "prompt_sha256": unit["prompt_sha256"],
            "config": {
                "model_id": unit["model_id"],
                "provider": "anthropic-session",
                "temperature": 0,
                "seed": None,
                "max_tokens": None,
                "note": "Claude 세션에서 직접 실행 — API 호출 없음",
            },
            "response": {
                "model_id_requested": unit["model_id"],
                "model_id_actual": unit["model_id"],
                "content": content,
                "finish_reason": "session",
                "usage": {
                    "prompt_tokens": None,
                    "completion_tokens": None,
                    "total_tokens": None,
                },
                "response_id": None,
                "elapsed_seconds": None,
            },
            "experiment_id": manifest["experiment_id"],
            "unit_id": uid,
            "input": {
                "repo": manifest["repo"],
                "commit": manifest["commit"],
                "file": manifest["file"],
                "lines": manifest["lines"],
                "code_sha256": manifest["code_sha256"],
            },
        }

        # JSON 저장
        json_path = out_dir / f"{uid}.json"
        with open(json_path, "w") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        # response.md 저장 (표준 형식)
        out_response = out_dir / f"{uid}.response.md"
        with open(out_response, "w") as f:
            f.write(f"# {uid}\n\n")
            f.write(f"- model: {unit['model_id']}\n")
            f.write(f"- model_actual: {unit['model_id']}\n")
            f.write(f"- provider: anthropic-session\n")
            f.write(f"- timestamp: {timestamp}\n")
            f.write(f"- temperature: 0\n")
            f.write(f"- seed: N/A\n")
            f.write(f"- prompt_sha256: {unit['prompt_sha256']}\n")
            f.write(f"- tokens: session (미측정)\n")
            f.write(f"- elapsed: session (미측정)\n\n")
            f.write(f"---\n\n")
            f.write(content)

        print(f"[PACKAGED] {uid}")
        results.append(result)

    # 요약 JSON 저장
    summary = {
        "experiment_id": manifest["experiment_id"],
        "session_dir": str(session_dir),
        "code_sha256": manifest["code_sha256"],
        "models": manifest["models"],
        "groups": manifest["groups"],
        "total_units": len(manifest["units"]),
        "completed": len(results),
        "skipped": skipped,
        "results": [
            {
                "unit_id": r["unit_id"],
                "model": r["model_name"],
                "group": r["prompt_group"],
                "prompt_sha256": r["prompt_sha256"],
            }
            for r in results
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    summary_path = out_dir / f"{manifest['experiment_id']}_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n완료: {len(results)}/{len(manifest['units'])}")
    if skipped:
        print(f"스킵: {skipped}")
    print(f"요약: {summary_path}")


# ─── CLI ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="세션 기반 실험 실행기 (Anthropic 모델 전용)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
명령:
  prepare   입력 JSON에서 프롬프트 파일 생성
  package   Claude 응답을 표준 결과 형식으로 패키징

예시:
  # Step 1: 프롬프트 파일 생성
  python experiments/run_session.py prepare \\
    --inputs experiments/inputs/cheese_R4.json \\
    --models sonnet-4.6 opus-4.6 \\
    --groups B D \\
    --output-dir experiments/results/session/cheese-R4

  # Step 3: 패키징 (Step 2는 Claude가 수행)
  python experiments/run_session.py package \\
    --session-dir experiments/results/session/cheese-R4

등록된 세션 모델: sonnet-4.6, opus-4.6
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # prepare 서브커맨드
    p_prepare = sub.add_parser("prepare", help="프롬프트 파일 생성")
    p_prepare.add_argument("--inputs", type=str, required=True, help="입력 JSON 파일 경로")
    p_prepare.add_argument("--models", nargs="+", required=True,
                           help="세션 모델 이름 (예: sonnet-4.6 opus-4.6)")
    p_prepare.add_argument("--groups", nargs="+", default=None,
                           help="프롬프트 그룹 (기본: 입력 파일의 모든 그룹)")
    p_prepare.add_argument("--output-dir", type=str, required=True,
                           help="프롬프트 파일 저장 디렉토리")

    # package 서브커맨드
    p_package = sub.add_parser("package", help="응답 파일 패키징")
    p_package.add_argument("--session-dir", type=str, required=True,
                           help="prepare로 생성한 세션 디렉토리")
    p_package.add_argument("--output-dir", type=str, default=None,
                           help="결과 저장 디렉토리 (기본: session-dir)")

    args = parser.parse_args()

    if args.command == "prepare":
        cmd_prepare(args)
    elif args.command == "package":
        cmd_package(args)


if __name__ == "__main__":
    main()
