"""
점수 타입 정의

SandwichScore: Simplex 상의 점 (bread + cheese + ham = 100)
RawScores: 정규화 전 원시 점수
"""

__architecture_role__ = "types"

from dataclasses import dataclass
from typing import Self


@dataclass(frozen=True)
class SandwichScore:
    """
    Simplex 상의 점수 (정규화됨)

    불변조건: bread + cheese + ham = 100
    """
    bread: float   # 0 ~ 100
    cheese: float  # 0 ~ 100
    ham: float     # 0 ~ 100

    def __post_init__(self) -> None:
        # 부동소수점 오차 허용
        total = self.bread + self.cheese + self.ham
        if abs(total - 100) > 0.01:
            raise ValueError(f"SandwichScore must sum to 100, got {total}")

    @classmethod
    def balanced(cls) -> Self:
        """균등 분배된 점수 반환"""
        return cls(bread=33.33, cheese=33.33, ham=33.34)

    @classmethod
    def from_raw(cls, bread: float, cheese: float, ham: float) -> Self:
        """원시 점수를 정규화하여 생성"""
        total = bread + cheese + ham
        if total == 0:
            return cls.balanced()
        return cls(
            bread=(bread / total) * 100,
            cheese=(cheese / total) * 100,
            ham=(ham / total) * 100,
        )

    def to_tuple(self) -> tuple[float, float, float]:
        """튜플로 변환"""
        return (self.bread, self.cheese, self.ham)


@dataclass
class RawBreadScore:
    """🍞 Security 원시 점수"""
    trust_boundary_count: int = 0
    auth_explicitness: float = 0.0
    secret_lifecycle_score: float = 0.0
    blast_radius: float = 0.0

    @property
    def total(self) -> float:
        """총점 계산"""
        return (
            self.trust_boundary_count * 10 +
            self.auth_explicitness * 20 +
            self.secret_lifecycle_score * 15 +
            self.blast_radius * 5
        )


@dataclass
class RawCheeseScore:
    """🧀 Cognitive 원시 점수"""
    cognitive_complexity: float = 0.0
    nesting_penalty: float = 0.0
    hidden_coupling: float = 0.0
    state_async_retry_violation: bool = False

    @property
    def total(self) -> float:
        """총점 계산 (높을수록 나쁨)"""
        violation_penalty = 50.0 if self.state_async_retry_violation else 0.0
        return (
            self.cognitive_complexity +
            self.nesting_penalty +
            self.hidden_coupling * 5 +
            violation_penalty
        )


@dataclass
class RawHamScore:
    """🥓 Behavioral 원시 점수"""
    golden_test_coverage: float = 0.0  # 0.0 ~ 1.0
    contract_test_exists: bool = False
    critical_paths_protected: int = 0
    critical_paths_total: int = 0

    @property
    def total(self) -> float:
        """총점 계산"""
        contract_bonus = 20.0 if self.contract_test_exists else 0.0
        path_ratio = (
            self.critical_paths_protected / self.critical_paths_total
            if self.critical_paths_total > 0 else 0.0
        )
        return (
            self.golden_test_coverage * 50 +
            contract_bonus +
            path_ratio * 30
        )


@dataclass
class RawScores:
    """모든 축의 원시 점수"""
    bread: RawBreadScore
    cheese: RawCheeseScore
    ham: RawHamScore

    def to_sandwich(self) -> SandwichScore:
        """SandwichScore로 변환"""
        # 🧀 Cheese는 높을수록 나쁘므로 역수 사용
        # 나머지는 높을수록 좋음
        cheese_inverted = max(1, 100 - self.cheese.total)

        return SandwichScore.from_raw(
            bread=self.bread.total,
            cheese=cheese_inverted,
            ham=self.ham.total,
        )
