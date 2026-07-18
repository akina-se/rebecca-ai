# Shared gRPC Schemas (`packages/grpc-schemas`)

This module houses the Protocol Buffer (`.proto`) schemas that define internal, typed inter-service APIs between Rebecca's microservices.

---

## 📡 Protocol Buffers Contract
Instead of relying on HTTP/REST, internal control commands (like tweet deletion triggered from the dashboard) are routed via **gRPC** to ensure minimum communication latency, strict serialization typing, and HTTP/2 connection reuse.

### Schema Files
- **[`tweets.proto`](./tweets.proto)**: Defines `TweetService` featuring:
  - `DeleteTweet`: Triggers deletion on X (Twitter) and Firestore.

---

## 🛠️ Dynamic Compilation & Loading
The protobuf configurations are loaded dynamically at runtime using `@grpc/proto-loader` in both:
- `apps/bot-backend` (as a gRPC Server on port `50051`)
- `apps/dashboard-backend` (as a gRPC Client connection)

This dynamic loading design eliminates the need for separate compile-step code-generation stages, simplifying build configurations while maintaining 100% contract type safety.
