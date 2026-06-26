# Python Agent Overlay

Read this Python/FastAPI toolchain reference before `AGENTS.md` when doing TaxPulse Python service work. It preserves the Week 1 Day 3 notes on Python syntax, asyncio, strict tooling, and pydantic so future agents can apply the same conventions.

## Source Lesson

## Week 1 · Day 3: Python Toolchain, Idioms & Async

Add a strict, reproducible Python service beside the TypeScript monorepo — fluent in asyncio, the idioms FastAPI depends on, and the same rigor enforced by ruff, mypy, and pydantic.

## Topic 1 of 7: Python 3.13 and two concurrency models

### Why Do I Need to Know This?

Your team is about to run two services with two different concurrency models — Node’s event loop and Python’s threads and asyncio under the GIL (Global Interpreter Lock — a mechanism that lets only one thread run Python bytecode at a time). The Module 4 decision of "when Python, when TS" depends on understanding that difference, so that the choice is a reasoned one about the workload rather than a preference for one language’s libraries.

### Scenario

In the polyglot-strategy brief — a short document your team writes to justify which language handles which workload in your multi-language (polyglot) codebase — a teammate argues for Python on a CPU-heavy multi-state allocation calculation "because we can use threads." You walk through the GIL with them: CPU-bound work does not get faster across threads in standard CPython, while I/O-bound work is exactly where asyncio shines. The brief shifts from "which language do we like" to "which concurrency model fits this workload."

### Theory

The GIL: one thread runs Python at a time
Standard CPython has a Global Interpreter Lock (GIL): only one thread executes Python bytecode at a time. So spreading a CPU-bound loop across threads does not speed it up — the threads take turns. Threads still help for I/O-bound work, because a thread waiting on the network or disk releases the GIL while it waits. For CPU-bound parallelism in Python you reach for multiple processes, not threads.

Two models, two sweet spots
This is the contrast that sets up the Module 4 service decision:

Node Python
Concurrency for I/O single event loop asyncio event loop
CPU parallelism worker threads / processes multiple processes (GIL limits threads)
Default mental model "never block the one loop" "never block the loop; offload CPU work"
Both runtimes punish a blocked loop the same way (the asyncio essentials and the sync-I/O-in-async pitfall topic below covers the Python version of that bug). The difference is where CPU work goes. #### Python 3.13 and the free-threaded build

This program locks Python 3.13, which brought clearer error messages (useful when you debug without AI in a closed-book check) and typing improvements. Python 3.13 also introduced a free-threaded ("no-GIL") build.

#### Note

In 3.13 the free-threaded build is an experimental preview, not the default and not for production. It became officially supported (still optional, still not the default) in Python 3.14 under PEP 779, with a much smaller single-threaded penalty (PEP 779). For this cohort’s locked 3.13, treat free-threading as "know it exists, do not depend on it."

Choosing a concurrency approach by workload
Start from the workload, not the language: the kind of work decides where it runs.

I/O-bound

CPU-bound

Is the work I/O-bound or CPU-bound?

I/O-bound (network, disk, DB)

CPU-bound (heavy computation)

Run it on the event loop -- Node loop or Python asyncio

Offload to multiple processes -- not threads in CPython

### Example

#### threads do not speed up cpu-bound python

```python
import threading, time

def count(n: int) -> None:
    while n > 0:
        n -= 1

# (1) Two threads, one CPU-bound task each — NOT ~2x faster under the GIL.
start = time.perf_counter()
t1 = threading.Thread(target=count, args=(50_000_000,))
t2 = threading.Thread(target=count, args=(50_000_000,))
t1.start(); t2.start(); t1.join(); t2.join()
print(f"threads: {time.perf_counter() - start:.2f}s")

# (2) For real CPU parallelism, use processes (multiprocessing), not threads.
```

Annotation (1) — the two threads take turns holding the GIL, so total time is close to running the counts one after another, not half of it.
Annotation (2) — CPU-bound parallelism in standard CPython needs separate processes; threads are for I/O-bound work that waits and releases the GIL.

### AI Practice

### Prompt it

Have Codex explain what the free-threaded build does and does not promise, then verify against the release notes.

```text
Explain what Python 3.13's free-threaded (no-GIL) build changes and what it does
not. Specifically: is it the default build, is it production-ready in 3.13, and
what happened to its status in 3.14? Cite the Python release notes or PEP 779.
Do not claim it makes all Python code faster.
```

### Watch out

Codex tends to overstate this — claiming the GIL is "gone in 3.13" or that all code gets faster. The free-threaded build is an opt-in, was experimental in 3.13, and adds a single-threaded penalty. Check its answer against PEP 779 and the 3.13/3.14 release notes before accepting.

### Verify

Confirm the explanation says the free-threaded build is opt-in (not the default), was experimental in 3.13, and became officially supported in 3.14 (PEP 779). Reject any claim that 3.13 removed the GIL by default. Record the corrected facts in your prompt journal.

### Knowledge Check

1. A teammate wants to speed up a CPU-bound calculation by running it across four threads in standard CPython 3.13. What happens?
   It runs roughly four times faster, one core per thread.
   It does not speed up meaningfully, because the GIL serializes the threads.
   It crashes as soon as a thread is spawned beyond the host machine’s core count.
   It silently switches to the free-threaded no-GIL build to parallelize.
2. Where does threading still help in standard CPython?
   I/O-bound work, where a waiting thread releases the GIL.
   CPU-bound matrix math spread one chunk per worker thread.
   Nowhere useful — threads only add overhead in modern CPython.
   Only after enabling the experimental free-threaded build.
3. How should you describe the free-threaded build in the locked Python 3.13?
   The default interpreter that ships when you install 3.13.
   An experimental, opt-in preview — do not depend on it.
   A fully production-supported build with no single-thread penalty.
   A build that was removed in 3.13 in favor of multiprocessing.
4. Why does the polyglot-strategy brief need to reference the two concurrency models, not just library preference?
   Because Python’s libraries are too immature for production federal work.
   Because Node’s single event loop cannot handle concurrent I/O at all.
   Because I/O-bound and CPU-bound work map to different models.
   Because the GIL constrains Node’s worker threads the same way.

## Topic 2 of 7: asyncio essentials and the sync-I/O-in-async pitfall

### Why Do I Need to Know This?

The Module 4 FastAPI service (FastAPI is a Python web framework for building async HTTP services) is asynchronous, and its single most common production failure is a synchronous I/O call inside an async handler that stalls every request — the Python mirror of the 1.2 TypeScript, Node & Async Fundamentals lesson. Your team needs the asyncio mental model now, so that bug never ships when the FastAPI work begins.

### Scenario

Your team’s Python skeleton has an async handler that calls a synchronous database driver "to start simple." Under concurrent load every request slows at once, because the sync call blocks the event loop between await points. You trace it in the debugger, see the call sitting on the loop with no await, and switch to an async driver — or offload the blocking call to a thread.

### Theory

Control returns to the loop only at an await
A coroutine runs on the event loop until it hits an await on something that actually yields (a network call, asyncio.sleep). At that point control returns to the loop, which can run another coroutine. Between await points your code runs to completion with no interruption — so a synchronous call with no await holds the loop for its entire duration, and every other coroutine waits.

The FastAPI pitfall, precisely
FastAPI handles two function kinds differently (FastAPI: async/await docs):

A def (non-async) path operation is run in an external threadpool, so a blocking call there does not stall the loop (though the threadpool is finite — AnyIO, the async library FastAPI runs on, defaults to 40 worker threads).
An async def path operation runs directly on the event loop. A blocking synchronous call inside it — time.sleep, a sync DB driver — stalls the whole service.

#### Important

Inside an async def, never make a blocking synchronous call. Use an async library (await it), or offload the blocking call to a thread with asyncio.to_thread(...). A single blocking call in one async endpoint can collapse concurrency for every request.

Trace async execution with the debugger
When async ordering is wrong or the loop stalls, use debugpy or a breakpoint() rather than print. The debugger lets you step across await points and see which call is holding the loop — the same "what is on the stack right now" question as the Node lesson, answered for Python. The walkthrough below shows the exact commands and the attach steps.

A blocking call stalls every request on the loop
Two concurrent requests on one event loop; a synchronous call in request A blocks request B until it returns.

Request B
Request A
Event loop
await async_db_read()
1
serve B while A awaits
2
time.sleep(2) (sync, no await)
3
B is stuck until A's sync call returns
4

### Example

#### the blocking handler versus the async one

```python
import asyncio, time

# (1) BLOCKS the loop: no await, so every request waits 2s.
async def bad_handler() -> str:
    time.sleep(2)                      # synchronous — stalls the event loop
    return "done"

# (2) YIELDS the loop: other requests run during the wait.
async def good_handler() -> str:
    await asyncio.sleep(2)             # awaitable — control returns to the loop
    return "done"

# (3) For an unavoidable blocking call, offload it to a thread.
async def offloaded_handler() -> str:
    await asyncio.to_thread(time.sleep, 2)
    return "done"
```

Annotation (1) — time.sleep is synchronous; inside async def it holds the loop, so concurrent requests queue behind it.
Annotation (2) — await asyncio.sleep yields control back to the loop, which serves other requests during the wait.
Annotation (3) — when you must call blocking code, asyncio.to_thread runs it off the loop so the loop stays responsive.

### Example

#### running debugpy and attaching the debugger

```python
# (1) Drop a breakpoint in code — the zero-setup option, no extra tool.
#     Execution stops here and gives you an interactive prompt (pdb).
#     Add this line inside the handler you want to inspect:
#         breakpoint()

# (2) Or run under debugpy and wait for an editor to attach on port 5678.
python -m debugpy --listen 5678 --wait-for-client -m svc_py.main
```

Annotation (1) — breakpoint() is the fastest path: drop it in the suspect handler, run the program, and you land in an interactive debugger at that line with no configuration.
Annotation (2) — python -m debugpy --listen 5678 --wait-for-client … starts the process but pauses until a debugger connects, so you can attach before the code under suspicion runs.
Annotation (3) — with the process waiting, open the Run and Debug panel in VS Code (macOS: Cmd+Shift+D; Windows/Linux: Ctrl+Shift+D), pick Attach to svc-py, and press play (F5). To diagnose a stalled loop: step across the await points and watch the Call Stack — a bare synchronous call (like the time.sleep from the previous example) sits on the stack with no await above it, which is the line to fix.

### AI Practice

### Prompt it

Ask Codex for an async handler that reads from a database, and reject any version that blocks the loop.

```text
Write an async def handler that reads a record by id from the database and
returns it. Requirements: do not make a blocking synchronous call inside the
async function — use an async database call you await, or offload a blocking
call with asyncio.to_thread. Add a one-line comment explaining why a sync DB
call inside async def would stall the service.
```

### Watch out

Codex often writes an async def and then calls a synchronous driver (or time.sleep) inside it with no await — exactly the pitfall. It may also "fix" it by adding async keywords without changing the blocking call underneath. Confirm the blocking work is either awaited on an async API or wrapped in asyncio.to_thread.

### Verify

Trace the handler in debugpy and confirm control reaches an await (or an asyncio.to_thread offload) rather than a bare synchronous call. Write a pytest-asyncio test (the plugin that lets pytest run async def tests) that runs two calls concurrently using asyncio.gather and asserts the total elapsed time is less than 2× the single-handler duration — confirming they ran in parallel rather than back-to-back. Record in your prompt journal whether Codex’s first attempt blocked the loop.

### Knowledge Check

1. Inside an async def FastAPI endpoint, a teammate calls a synchronous database driver with no await. What is the effect under load?
   It stalls the loop, so every request slows until it returns.
   Only the slow endpoint queues; unrelated routes stay responsive.
   FastAPI detects the sync driver and moves it to a threadpool.
   It raises a RuntimeError because sync calls are forbidden in async.
2. Which is the correct fix for an unavoidable blocking call inside an async def?
   Sprinkle async/await keywords over the call site to make it yield.
   Insert a short time.sleep(0) first to give the loop a break.
   Wrap the call in a try/except so it cannot stall the loop.
   Offload it with await asyncio.to_thread(blocking_call, ...).
3. Why is a def (non-async) FastAPI path operation less dangerous for a blocking call than an async def one?
   Because a def function is structurally incapable of blocking the interpreter.
   Because FastAPI runs def operations in a threadpool, off the loop.
   Because def functions run faster than async def equivalents.
   Because declaring def disables the GIL for that call.
4. When async ordering looks wrong, what is the most useful tool to diagnose it?
   Scatter print calls at the start of each coroutine.
   Raise the AnyIO threadpool size from 40 to clear the backlog.
   Step through it in debugpy across the await points.
   Restart the service and watch whether the ordering recurs.

## Topic 3 of 7: The Python idioms FastAPI depends on

### Why Do I Need to Know This?

FastAPI’s dependency injection (a pattern where a function declares what it needs and the framework supplies it, rather than constructing it directly), lifecycle hooks, and streaming responses are built on three plain-Python idioms: decorators, context managers, and generators. If your team treats them as framework syntax to copy, the Module 4 FastAPI work becomes guesswork; learning them now makes that framework read like ordinary Python you already understand.

### Scenario

Your team’s skeleton needs a per-request resource — a settings object that is set up and cleanly torn down on every request. You implement it as a yield-based dependency: a generator that sets up before the yield, hands the value to the handler, and tears down after. That is the exact shape FastAPI’s Depends (the function that tells the framework which dependency to inject into a handler) uses, and you add a small decorator that logs each call to confirm the idiom works.

### Theory

Decorators wrap a function
A decorator is a function that takes a function and returns a new one wrapping it — adding behavior (logging, timing, auth) without changing the original body. FastAPI’s @app.get(...) and Depends(...) are built on this idea: they wrap your handler to register a route or inject a dependency.

Context managers guarantee teardown
A context manager runs setup on entry and teardown on exit, even if the body raises. You write one with a class (**enter**/**exit**) or, more commonly, the @contextmanager decorator over a generator. This is how you guarantee a resource (a file, a connection) is released.

Generators yield a sequence — and power yield-based dependencies
A generator function uses yield to produce values lazily instead of building a whole list. FastAPI’s dependency system uses this shape directly: a dependency function does setup, yields the value the handler uses, and runs teardown after the handler returns. The yield is the seam between setup and teardown.

A yield-based dependency's lifecycle
How setup, the handler, and teardown map onto a generator’s yield.

Setup (before yield)

yield value -> handler runs

Teardown (after yield)

### Example

#### the three idioms together

```python
from contextlib import contextmanager
from collections.abc import Iterator
import functools, time

# (1) Decorator: wrap a function to log each call.
def log_calls(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        print(f"calling {fn.__name__}")
        return fn(*args, **kwargs)
    return wrapper

# (2) Context manager: guaranteed setup/teardown via a generator.
@contextmanager
def timed(label: str) -> Iterator[None]:
    start = time.perf_counter()
    try:
        yield
    finally:
        print(f"{label}: {time.perf_counter() - start:.3f}s")

# (3) Yield-based dependency: the FastAPI shape — setup, yield, teardown.
def get_settings() -> Iterator[dict[str, str]]:
    settings = {"env": "test"}        # setup
    yield settings                     # handler uses this value
    settings.clear()                   # teardown after handler returns
```

Annotation (1) — @log_calls returns a wrapper, the decorator pattern @app.get builds on; functools.wraps preserves the original function’s name.
Annotation (2) — @contextmanager turns the generator into a with-usable block; the finally guarantees teardown even on error.
Annotation (3) — get_settings is shaped exactly like a FastAPI dependency: setup, yield, teardown. Module 4 reuses this directly.

### AI Practice

### Prompt it

Have Codex implement a yield-based dependency and explain it, then verify the teardown runs.

```text
Write a yield-based dependency function get_db() that creates a fake database
connection (a dict), yields it, and closes it (sets a closed flag) after the
yield — the same shape FastAPI's Depends uses. Then EXPLAIN, step by step, when
the setup code, the handler, and the teardown each run relative to the yield.
```

### Watch out

Codex sometimes writes a plain return instead of yield (which skips the teardown phase), or puts teardown before the yield where it runs too early. It may also forget that teardown should be in a finally so it runs even when the handler raises. Check that teardown is after the yield and protected by finally.

### Verify

Trace the dependency in debugpy and confirm the order: setup runs, the handler runs while paused at the yield, teardown runs after. Force the handler to raise and confirm teardown still runs (it must be in a finally). Record the observed order in your prompt journal.

### Knowledge Check

1. What does a decorator do, and which FastAPI feature is built on it?
   It renames a function at import time; Query is built on it.
   It converts a plain function into a coroutine; await is built on it.
   It validates a function’s argument types; pydantic is built on it.
   It wraps a function to add behavior; @app.get and Depends use it.
2. In a yield-based dependency, when does the teardown code (after the yield) run?
   After the handler returns, and on error if guarded by finally.
   Before the handler runs, as the very first step of request setup.
   Never, because yield discards everything written below it.
   Only when the handler succeeds, never on an exception path.
3. Why use @contextmanager over a generator instead of writing **enter**/**exit** by hand?
   It is the only construct in Python that can guarantee teardown.
   It expresses setup, yield, and teardown in one short generator.
   It makes the wrapped with block run asynchronously on the event loop.
   It releases the GIL for the duration of the with block.
4. A teammate writes a dependency that uses return settings instead of yield settings. What is lost?
   Nothing meaningful — return and yield behave identically for a dependency.
   The setup phase that runs before the value reaches the handler.
   The teardown phase — return leaves no code to run afterward.
   Static type checking of the value the dependency hands back.

## Topic 4 of 7: Typing beyond pydantic — Protocol, generics, and TypedDict

### Why Do I Need to Know This?

pydantic validates data at the boundary, but inside the service your team needs static typing that mypy strict can check — and Protocol gives you the structural typing that mirrors TypeScript’s interfaces. Getting these right is what lets the Python service meet the same strict bar you set on the TypeScript side, instead of being the untyped, unchecked part of the codebase that mypy cannot verify.

### Scenario

Your team wants to swap a real storage client for a fake in tests, without forcing both to inherit a shared base class. You define a Protocol that describes the methods your code actually calls. A fake that has those methods passes mypy strict; a fake missing one fails — the static, compile-time mirror of the runtime checks pydantic does at the boundary.

### Theory

Protocol: structural typing, checked statically
A Protocol describes a shape — the methods and attributes a value must have. Any class that has them satisfies the protocol without inheriting from it (structural, or "duck", typing). This is the direct parallel to a TypeScript interface, and it is ideal for test doubles: your fake matches the protocol by shape, and mypy strict verifies it (Python typing docs).

Generics: typed reusable code
TypeVar and Generic let you write a helper or container typed over a parameter, so the type flows through instead of collapsing to Any — the parallel to TypeScript generics. A def first[T](items: list[T]) -> T returns the same type it was given: the [T] is Python 3.12’s shorthand for declaring a TypeVar, so you rarely write an explicit TypeVar by hand anymore.

TypedDict: typing dict-shaped data
TypedDict types a dictionary with known keys and value types, for when the data is genuinely a dict (an external JSON payload you do not want to wrap in a full model) but you still want mypy to check the keys.

#### Tip

Use the right tool for the shape. A Protocol types an object’s behavior (its methods). A TypedDict types a dict’s keys. pydantic validates untrusted data at runtime. They are complementary: Protocol and TypedDict are static (mypy), pydantic is runtime.

A Protocol is a shape contract, not a base class
How two unrelated classes satisfy a protocol by shape, while a third fails.

satisfies (structural)

satisfies (structural)

fails mypy -- missing put

Storage (Protocol): get(id), put(id, value)

RealStorage: get, put

FakeStorage: get, put

BrokenFake: get only

### Example

#### a protocol and a test double mypy strict checks

```python
from typing import Protocol

# (1) The shape the code depends on — no base class required.
class Storage(Protocol):
    def get(self, id: str) -> str | None: ...
    def put(self, id: str, value: str) -> None: ...

# (2) A fake that matches the shape — satisfies Storage structurally.
class FakeStorage:
    def __init__(self) -> None:
        self._data: dict[str, str] = {}
    def get(self, id: str) -> str | None:
        return self._data.get(id)
    def put(self, id: str, value: str) -> None:
        self._data[id] = value

# (3) Code typed against the Protocol accepts the fake.
def save_default(store: Storage) -> None:
    store.put("default", "on")

save_default(FakeStorage())   # passes mypy strict — FakeStorage matches the shape
```

Annotation (1) — Storage lists only the methods the code uses; it is a contract, not a parent class.
Annotation (2) — FakeStorage never imports or inherits Storage, yet satisfies it because it has the right methods.
Annotation (3) — save_default is typed against the protocol, so any structurally-matching object works; a fake missing put would fail mypy strict.

### AI Practice

### Prompt it

Have Codex write a Protocol and a test double, then verify the strict check catches a wrong shape.

```text
Define a Protocol named Notifier with one method: send(self, to: str, body: str) -> bool.
Write a FakeNotifier that satisfies it structurally (no inheritance) and records sent
messages. Then write a BrokenNotifier that is missing the method, and show the mypy
error you would expect when passing it where a Notifier is required.
```

### Watch out

Codex sometimes makes the fake inherit from the Protocol (unnecessary, and it hides the structural-typing point), or types the parameter as a concrete class instead of the Protocol (which defeats the swap). It may also claim the broken fake passes. Confirm the fake does not inherit, the parameter is typed as the Protocol, and the broken case is described as a mypy failure.

### Verify

Run mypy --strict on the file. Confirm the structurally-correct fake passes and that adding the broken fake at a call site produces a mypy error naming the missing method. If mypy accepts the broken fake, the parameter was not typed against the Protocol — reject and fix. Record the result in your prompt journal.

### Knowledge Check

1. What makes a Protocol different from a normal base class in Python?
   A Protocol dispatches method calls faster than a base class at runtime.
   A Protocol validates incoming data at runtime the way pydantic does.
   A Protocol may declare exactly one method, unlike a base class.
   A class satisfies it by shape, without inheriting from it.
2. Why is Protocol well suited to test doubles?
   A fake matching the methods satisfies it with no shared base class.
   It auto-generates a stub fake class from the real class’s signature.
   It relaxes type checking inside test modules to ease mocking.
   It re-wraps the fake as a pydantic model for validation.
3. You receive an external JSON payload with known keys and want mypy to check key access without building a full model. Which tool fits?
   A Protocol describing the payload’s expected methods.
   A TypedDict for the payload.
   A TypeVar parameterized over the payload’s value types.
   A bare dict[str, object] annotation on the variable.
4. A function is typed def save(store: FakeStorage) instead of def save(store: Storage). Why does this defeat the purpose of the Protocol?
   It fails to compile because a fake class cannot be used as an annotation.
   It silently turns the function into an async coroutine.
   It ties the function to one class, so the real one cannot swap in.
   It causes mypy to skip type checking that function entirely.
5. You need a helper that returns one item of the same type as the list passed in, checked by mypy. Which typing tool expresses that?
   A Protocol describing the methods the list elements share.
   A generic type parameter, e.g. def first[T](items: list[T]) -> T.
   A TypedDict mapping element positions to their types.
   Annotating both the list parameter and the function’s return as Any.

## Topic 5 of 7: A reproducible, strict Python project

### Why Do I Need to Know This?

A reproducible, strictly-checked Python project is non-negotiable for federal evidence, and the choices that get you there are made once on day three and inherited for the rest of the program. uv or poetry, the src/ layout, ruff, and mypy strict are the Python equals of the strict-TypeScript floor your team already set.

### Scenario

Your team debates uv versus poetry for apps/svc-py, picks one, and lays out a src/ package with a pyproject.toml that declares dependencies, tool configuration, and an entry point. You confirm ruff format --check and mypy --strict both stay green before anything becomes a PR. When Codex adds a # type: ignore with no reason, you reject it — AGENTS.md requires a written justification for every one.

### Theory

A project manager and a src/ layout
uv and poetry both manage dependencies and a lockfile; uv is a single fast standalone binary that this program standardizes on, with a committed uv.lock pinning exact versions (uv docs). The src/ layout puts your package under src/ so tests import the installed package, not loose files in the working directory — which prevents "works in the repo, breaks when installed" surprises.

pyproject.toml is the single descriptor
One file declares the project and configures every tool: dependencies, the [project.scripts] entry point, [tool.ruff], and [tool.mypy]. Centralizing configuration means a teammate reads one file to understand the whole project.

ruff and mypy: the two gates
A change passes two gates before it becomes a PR:

ruff does both linting and formatting in one fast tool (its formatter is black-compatible), replacing several older tools (ruff docs).
mypy in strict mode ([tool.mypy] strict = true) catches type errors ruff does not — an untyped function boundary, a missing return, an unsafe Any.

#### Important

No # type: ignore without a written justification. A bare # type: ignore silences mypy and hides the very bug strict mode exists to catch. AGENTS.md requires a one-line reason on every one, mirroring the no-any rule on the TypeScript side. Reject Codex output that adds an unexplained ignore.

Two gates before a PR
How a change passes ruff and mypy strict, and where an unexplained ignore is rejected.

clean

unexplained type: ignore

Code change

ruff check + ruff format

mypy --strict

Open PR

Reject + prompt-journal entry

### Example

#### pyproject.toml and a boundary mypy strict rejects

```toml
# pyproject.toml — single descriptor for the Python service
[project]
name = "svc-py"
version = "0.1.0"
dependencies = ["pydantic>=2"]

[project.scripts]
svc = "svc_py.main:run"        # entry point: `svc` runs svc_py/main.py:run()

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true                  # all strict flags on
```

Annotation (1) — under strict = true, an untyped function boundary is an error; this is the bug class strict mode exists to catch.
Annotation (2) — the typed signature passes, and any caller now gets checked against it.
The [project.scripts] entry point means svc runs the service, and uv.lock (committed) makes the install reproducible.

### AI Practice

### Prompt it

Have Codex generate the project config, then reject any unexplained type-ignore.

```text
Generate a pyproject.toml for a package named svc-py using a src/ layout: include
a [project.scripts] entry point named svc that runs svc_py.main:run, a [tool.ruff]
section, and [tool.mypy] with strict = true. Then add a typed function total() over
a list of line items that passes mypy --strict. Do not use `# type: ignore` anywhere.
```

### Watch out

Codex sometimes makes a function pass strict by adding # type: ignore or annotating with Any instead of a real type — both defeat the gate. It may also place the package outside src/, so tests import loose files instead of the installed package. Check for unexplained ignores, stray Any, and the src/ layout.

### Verify

Run ruff check, ruff format --check, and mypy --strict — all three must be green. Search the diff for # type: ignore and confirm any present has a written reason; reject unexplained ones. Confirm the package lives under src/ and uv.lock (or the poetry lock) is committed. Record what Codex attempted in your prompt journal.

### Knowledge Check

1. What does the src/ layout protect against?
   Slow module imports once the service is running under load.
   The GIL serializing module imports across worker threads at startup.
   mypy quietly falling back to non-strict mode on the package.
   Tests importing loose working-dir files, not the installed package.
2. Codex makes a function pass mypy --strict by adding a bare # type: ignore. Per the team standard, what happens?
   Reject it; require a written justification, or fix the types.
   Accept it since the type checker now reports a clean run.
   Accept it as long as the ignore sits in a test file, not source.
   Swap the ignore for an Any annotation on the offending value.
3. Which tool handles both linting and formatting in this stack?
   mypy.
   ruff.
   pytest.
   uv.
4. What is the role of a committed uv.lock (or poetry lock) file?
   It speeds up request handling once the service is deployed.
   It replaces pyproject.toml as the project’s single descriptor.
   It pins exact versions so installs reproduce across machines.
   It turns on mypy strict mode for the whole package.

## Topic 6 of 7: pydantic v2 for validated boundaries

### Why Do I Need to Know This?

Your two services must agree on data, and pydantic v2 is how the Python side enforces a contract at runtime the way TypeScript types do at compile time. It is also where your team picks a single cross-language schema source of truth, so the contracts cannot silently drift between the TypeScript and Python services.

### Scenario

Your team defines its first shared pydantic models for apps/svc-py, parallel to the TypeScript shared-types package. One record has several variants, so you model it as a discriminated union keyed by a type field, and you agree that a JSON Schema is the source of truth both languages derive from — so a change to the contract shows up on both sides.

### Theory

model_validate parses untrusted input
model_validate takes untrusted input (a dict from a request body, a parsed JSON payload) and either returns a fully typed model or raises a ValidationError describing exactly what was wrong. This is the runtime boundary check: bad data fails loudly at the edge instead of flowing into your code as a malformed dict (pydantic docs).

computed_field exposes derived values
computed_field turns a method into a field that travels with the model — for example a total derived from quantity and price — so consumers and serialized output see the derived value without recomputing it.

Discriminated unions select one variant by a tag
When a record has several shapes, a discriminated union keyed by a literal field validates against exactly the right variant. You declare it with Field(discriminator="type") over a union of models, each with a distinct literal type. pydantic uses the discriminator to pick one member instead of trying each, which gives clearer errors and faster validation (pydantic: unions). This mirrors the TypeScript discriminated unions introduced in the TypeScript lesson.

model_validate at the boundary
How untrusted input becomes either a typed model or a validation error.

Result
Model.model_validate()
Input
{"type": "wages", "amount": 100}
1
typed model (valid)
2
{"type": "wages"} (missing amount)
3
ValidationError (loud failure)
4

### Example

#### a discriminated union with a computed field

```python
from typing import Literal, Annotated, Union
from pydantic import BaseModel, Field, computed_field

# (1) Two variants, each tagged by a literal `type`.
class Wages(BaseModel):
    type: Literal["wages"]
    amount: int
    rate: int
    @computed_field            # (2) derived value travels with the model
    @property
    def gross(self) -> int:
        return self.amount * self.rate

class Dividend(BaseModel):
    type: Literal["dividend"]
    amount: int

# (3) Discriminated union: pydantic picks the variant by `type`.
Income = Annotated[Union[Wages, Dividend], Field(discriminator="type")]

class Record(BaseModel):
    income: Income

# Valid; picks Wages and computes gross.
Record.model_validate({"income": {"type": "wages", "amount": 40, "rate": 25}})
```

Annotation (1) — each variant carries a distinct literal type, the discriminator field.
Annotation (2) — computed_field exposes gross as part of the model, derived from its fields.
Annotation (3) — Field(discriminator="type") tells pydantic to validate against the one matching variant, giving a clear error if type is unknown.

### AI Practice

### Prompt it

Have Codex build the discriminated union and an invalid-input test, then re-explain it closed-book.

```text
Create two pydantic v2 models, Wages and Dividend, each with a literal `type`
field, and combine them into a discriminated union using Field(discriminator="type").
Add a computed_field on Wages called gross (amount * rate). Then write a pytest test
that asserts model_validate raises ValidationError when `type` is missing.
```

### Watch out

Codex sometimes writes a plain Union without Field(discriminator=...), which still validates but with vaguer errors and no single-variant selection. It may also use pydantic v1 syntax (parse_obj, v1-style validators) instead of v2’s model_validate and computed_field. Confirm the discriminator is set and the API is v2.

### Verify

Run the test and confirm model_validate raises ValidationError for a missing or unknown type, and returns a typed model with a correct gross for valid wages input. Then close Codex and re-explain the discriminated union to an instructor — the day’s closed-book gate. Record the explanation points in your prompt journal.

### Knowledge Check

1. What does model_validate do with untrusted input that does not match the model?
   Silently coerces the bad fields to the nearest valid shape.
   Returns None so the caller can branch on a falsy result.
   Logs a warning and returns the partially-populated model.
   Raises a ValidationError describing what was wrong.
2. Why declare a union with Field(discriminator="type") instead of a plain Union?
   pydantic validates against the one variant the tag selects.
   Without the discriminator the models will not import or compile.
   It rewrites the union members into equivalent TypedDicts.
   It turns off field validation for every union member.
3. What does computed_field provide on a pydantic model?
   A required input field the caller must supply on construction.
   A derived value that travels with the model and its output.
   A switch that skips validation for the fields it reads from.
   A mapping from the model to a backing database column.
4. Codex generates the models using parse_obj and v1-style validators. What should you check?
   Nothing, since parse_obj is still the recommended current API.
   That a # type: ignore is added to quiet the version warnings.
   That it uses v2 APIs (model_validate, computed_field).
   That the discriminated union is rewritten as a plain Python list.
