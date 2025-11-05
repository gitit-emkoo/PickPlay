#pragma once

namespace folly {
namespace coro {

// Minimal stub to satisfy builds when coroutines are disabled.
struct CoroutineStubTag {};

} // namespace coro
} // namespace folly

