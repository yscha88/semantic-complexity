"""
Cross-language compatibility test sample (Python)

This file contains simple functions to test that all analyzers
produce compatible output structures across TypeScript, Python, and Go.
"""


def simple_control(x: int) -> str:
    """Simple function with control flow."""
    if x > 0:
        return "positive"
    elif x < 0:
        return "negative"
    return "zero"


def nested_loop(arr: list[list[int]]) -> int:
    """Function with nesting."""
    total = 0
    for row in arr:
        for val in row:
            if val > 0:
                total += val
    return total


def state_mutation() -> int:
    """Function with state mutations."""
    state = 0
    status = "idle"

    status = "processing"
    state = 1

    status = "done"
    state = 2

    return state


async def async_function() -> str:
    """Async function."""
    import aiohttp
    async with aiohttp.ClientSession() as session:
        async with session.get("/api/data") as response:
            data = await response.json()
            return data["message"]


def coupled_function(msg: str) -> None:
    """Function with coupling (side effects)."""
    print(msg)
    with open("last_msg.txt", "w") as f:
        f.write(msg)
