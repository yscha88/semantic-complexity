"""Tests for core complexity analysis."""

from semantic_complexity import (
    DEFAULT_WEIGHTS,
    DimensionalComplexity,
    DimensionalWeights,
    __version__,
    analyze_functions,
    analyze_source,
)

# ─────────────────────────────────────────────────────────────────
# Version & Weights Tests
# ─────────────────────────────────────────────────────────────────

def test_version():
    """Test package version."""
    assert __version__ == "0.0.3"


def test_default_weights():
    """Test default weight values match spec."""
    assert DEFAULT_WEIGHTS.control == 1.0
    assert DEFAULT_WEIGHTS.nesting == 1.5
    assert DEFAULT_WEIGHTS.state == 2.0
    assert DEFAULT_WEIGHTS.async_ == 2.5
    assert DEFAULT_WEIGHTS.coupling == 3.0


def test_custom_weights():
    """Test custom weight creation."""
    weights = DimensionalWeights(
        control=2.0,
        nesting=2.0,
        state=2.0,
        async_=2.0,
        coupling=2.0,
    )
    assert weights.control == 2.0
    assert weights.coupling == 2.0


# ─────────────────────────────────────────────────────────────────
# Basic Analysis Tests
# ─────────────────────────────────────────────────────────────────

def test_analyze_empty_source():
    """Test analysis of empty source."""
    result = analyze_source("")
    assert isinstance(result, DimensionalComplexity)
    assert result.control == 0
    assert result.nesting == 0
    assert result.weighted == 0.0


def test_analyze_simple_function():
    """Test analysis of simple function."""
    source = '''
def hello():
    print("Hello")
'''
    result = analyze_source(source)
    assert result.control == 0  # No branches
    assert result.coupling.implicit_io == 1  # print is IO


def test_analyze_syntax_error():
    """Test handling of syntax errors."""
    result = analyze_source("def broken(")
    assert isinstance(result, DimensionalComplexity)
    assert result.weighted == 0.0


# ─────────────────────────────────────────────────────────────────
# 1D Control Flow Tests
# ─────────────────────────────────────────────────────────────────

def test_control_if():
    """Test if statement control complexity."""
    source = '''
def check(x):
    if x > 0:
        return True
    return False
'''
    result = analyze_source(source)
    assert result.control == 1  # 1 if


def test_control_if_elif_else():
    """Test if-elif-else control complexity."""
    source = '''
def grade(score):
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    else:
        return "F"
'''
    result = analyze_source(source)
    assert result.control == 3  # if + 2 elif (else doesn't count)


def test_control_for_loop():
    """Test for loop control complexity."""
    source = '''
def sum_list(items):
    total = 0
    for item in items:
        total += item
    return total
'''
    result = analyze_source(source)
    assert result.control == 1


def test_control_while_loop():
    """Test while loop control complexity."""
    source = '''
def countdown(n):
    while n > 0:
        print(n)
        n -= 1
'''
    result = analyze_source(source)
    assert result.control == 1


def test_control_try_except():
    """Test try-except control complexity."""
    source = '''
def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return 0
    except TypeError:
        return None
'''
    result = analyze_source(source)
    assert result.control == 2  # 2 except handlers


def test_control_with_statement():
    """Test with statement control complexity."""
    source = '''
def read_file(path):
    with open(path) as f:
        return f.read()
'''
    result = analyze_source(source)
    assert result.control == 1


def test_control_boolean_operators():
    """Test boolean operator control complexity."""
    source = '''
def check(a, b, c):
    return a and b or c
'''
    result = analyze_source(source)
    assert result.control == 2  # 1 and + 1 or


def test_control_ternary():
    """Test ternary expression control complexity."""
    source = '''
def abs_val(x):
    return x if x >= 0 else -x
'''
    result = analyze_source(source)
    assert result.control == 1


def test_control_comprehension():
    """Test comprehension control complexity."""
    source = '''
def evens(n):
    return [x for x in range(n) if x % 2 == 0]
'''
    result = analyze_source(source)
    assert result.control >= 2  # 1 for loop + 1 if


def test_control_match_statement():
    """Test match statement control complexity (Python 3.10+)."""
    source = '''
def http_status(status):
    match status:
        case 200:
            return "OK"
        case 404:
            return "Not Found"
        case 500:
            return "Server Error"
'''
    result = analyze_source(source)
    assert result.control == 3  # 3 cases


# ─────────────────────────────────────────────────────────────────
# 2D Nesting Tests
# ─────────────────────────────────────────────────────────────────

def test_nesting_depth():
    """Test nesting depth calculation."""
    source = '''
def nested():
    if True:          # depth 1
        if True:      # depth 2
            if True:  # depth 3
                pass
'''
    result = analyze_source(source)
    assert result.nesting >= 6  # 1 + 2 + 3


def test_nesting_loop_in_loop():
    """Test nested loop complexity."""
    source = '''
def matrix(n):
    for i in range(n):
        for j in range(n):
            print(i, j)
'''
    result = analyze_source(source)
    assert result.nesting >= 3  # 1 + 2


# ─────────────────────────────────────────────────────────────────
# 3D State Tests
# ─────────────────────────────────────────────────────────────────

def test_state_mutations():
    """Test state mutation detection."""
    source = '''
def update():
    state = 0
    state += 1
    status = "done"
    return state
'''
    result = analyze_source(source)
    assert result.state.state_mutations >= 1  # state += 1


def test_state_pattern_detection():
    """Test state pattern variable detection."""
    source = '''
def fsm():
    is_running = True
    has_data = False
    current_phase = "init"
'''
    result = analyze_source(source)
    # Should detect is_, has_, phase as state patterns
    assert result.state.state_mutations >= 1


# ─────────────────────────────────────────────────────────────────
# 4D Async Tests
# ─────────────────────────────────────────────────────────────────

def test_async_function():
    """Test async function detection."""
    source = '''
async def fetch():
    return await get_data()
'''
    result = analyze_source(source)
    assert result.async_.async_boundaries == 1
    assert result.async_.await_count == 1


def test_async_for():
    """Test async for loop."""
    source = '''
async def stream():
    async for item in get_items():
        yield item
'''
    result = analyze_source(source)
    assert result.async_.async_boundaries >= 1


def test_async_with():
    """Test async with statement."""
    source = '''
async def connect():
    async with get_connection() as conn:
        return conn
'''
    result = analyze_source(source)
    assert result.async_.async_boundaries >= 1


def test_lambda_callback():
    """Test lambda callback detection."""
    source = '''
def setup():
    callback = lambda x: x * 2
'''
    result = analyze_source(source)
    assert result.async_.callback_depth == 1


# ─────────────────────────────────────────────────────────────────
# 5D Coupling Tests
# ─────────────────────────────────────────────────────────────────

def test_coupling_global():
    """Test global access detection."""
    source = '''
counter = 0
def increment():
    global counter
    counter += 1
'''
    result = analyze_source(source)
    assert result.coupling.global_access >= 1


def test_coupling_nonlocal():
    """Test nonlocal (closure) detection."""
    source = '''
def outer():
    count = 0
    def inner():
        nonlocal count
        count += 1
    return inner
'''
    result = analyze_source(source)
    assert result.coupling.closure_captures >= 1


def test_coupling_io():
    """Test IO function detection."""
    source = '''
def log_message(msg):
    print(msg)
    with open("log.txt", "a") as f:
        f.write(msg)
'''
    result = analyze_source(source)
    assert result.coupling.implicit_io >= 2  # print + open


def test_coupling_env():
    """Test environment dependency detection."""
    source = '''
import os
def get_config():
    return os.environ.get("CONFIG")
'''
    result = analyze_source(source)
    assert result.coupling.env_dependency >= 1


def test_coupling_side_effects():
    """Test side effect detection (self._private)."""
    source = '''
class Service:
    def update(self):
        self._cache = {}
        self._dirty = True
'''
    result = analyze_source(source)
    assert result.coupling.side_effects >= 1


# ─────────────────────────────────────────────────────────────────
# Function-level Analysis Tests
# ─────────────────────────────────────────────────────────────────

def test_analyze_functions():
    """Test function-level analysis."""
    source = '''
def simple():
    pass

def complex_one(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                print(i)
'''
    results = analyze_functions(source)
    assert len(results) == 2

    simple = next(f for f in results if f.name == "simple")
    assert simple.cyclomatic == 1  # base 1

    complex_fn = next(f for f in results if f.name == "complex_one")
    assert complex_fn.cyclomatic >= 3  # 1 + if + for + if


def test_function_location():
    """Test function location tracking."""
    source = '''
def first():
    pass

def second():
    pass
'''
    results = analyze_functions(source)
    assert len(results) == 2

    first = next(f for f in results if f.name == "first")
    assert first.lineno == 2
    assert first.end_lineno >= 3


def test_async_function_analysis():
    """Test async function analysis."""
    source = '''
async def fetch_data():
    await get()
    await process()
'''
    results = analyze_functions(source)
    assert len(results) == 1

    fn = results[0]
    assert fn.name == "fetch_data"
    assert fn.dimensional.async_.await_count == 2


# ─────────────────────────────────────────────────────────────────
# Weighted Score Tests
# ─────────────────────────────────────────────────────────────────

def test_weighted_calculation():
    """Test weighted score calculation."""
    source = '''
def complex_function(x):
    if x > 0:
        for i in range(x):
            state = i
            print(i)
'''
    result = analyze_source(source)
    assert result.weighted > 0

    # Verify contributions sum to ~1
    contrib = result.contributions
    total = sum(contrib.values())
    assert 0.99 <= total <= 1.01


def test_custom_weights_affect_score():
    """Test that custom weights change the score."""
    source = '''
def with_io():
    print("test")
'''
    default_result = analyze_source(source)

    # Heavy coupling weight
    heavy_weights = DimensionalWeights(
        control=1.0,
        nesting=1.0,
        state=1.0,
        async_=1.0,
        coupling=10.0,  # 10x coupling weight
    )
    weighted_result = analyze_source(source, weights=heavy_weights)

    # Coupling-heavy weights should increase score for IO-using code
    assert weighted_result.weighted > default_result.weighted


# ─────────────────────────────────────────────────────────────────
# Contributions Tests
# ─────────────────────────────────────────────────────────────────

def test_contributions_empty():
    """Test contributions for empty source."""
    result = analyze_source("")
    contrib = result.contributions
    assert all(v == 0 for v in contrib.values())


def test_contributions_structure():
    """Test contributions structure."""
    source = "def f(): pass"
    result = analyze_source(source)
    contrib = result.contributions

    assert "control" in contrib
    assert "nesting" in contrib
    assert "state" in contrib
    assert "async" in contrib
    assert "coupling" in contrib


# ─────────────────────────────────────────────────────────────────
# Edge Cases
# ─────────────────────────────────────────────────────────────────

def test_class_methods():
    """Test analysis of class methods."""
    source = '''
class Calculator:
    def add(self, a, b):
        return a + b

    def divide(self, a, b):
        if b == 0:
            raise ValueError()
        return a / b
'''
    results = analyze_functions(source)
    assert len(results) == 2


def test_nested_functions():
    """Test analysis of nested functions."""
    source = '''
def outer():
    def inner():
        pass
    return inner
'''
    results = analyze_functions(source)
    assert len(results) == 2


def test_generator_function():
    """Test generator function analysis."""
    source = '''
def gen(n):
    for i in range(n):
        yield i
'''
    results = analyze_functions(source)
    assert len(results) == 1
    assert results[0].dimensional.control == 1


def test_decorator():
    """Test decorated function analysis."""
    source = '''
def decorator(f):
    def wrapper(*args):
        return f(*args)
    return wrapper

@decorator
def decorated():
    pass
'''
    results = analyze_functions(source)
    assert len(results) == 3  # decorator, wrapper, decorated
