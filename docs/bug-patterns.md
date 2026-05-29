# SkillSync Bug Patterns & Root Cause Analysis

## 1. Mongoose Document Serialization over Socket.io
**Symptom**: Real-time events sent via Socket.io (like `new_message` or `new_notification`) fail to trigger correct UI updates on the client side, even though the events are emitted and received. In some cases, `socket.io-parser` may fail silently due to circular references in Mongoose internals.
**Root Cause**: Mongoose documents emitted directly through Socket.io without `.toJSON()` serialization can cause strict equality checks (`===`) on the frontend to fail. Socket.io traverses the document and reconstructs it, often turning `ObjectId`s into complex objects (e.g., `{ "$oid": "..." }` or `{ type: "Buffer", data: [...] }`) instead of standard 24-character hex strings, depending on the parser version and configuration.
**Fix/Prevention**: Always call `.toJSON()` or `.toObject()` on Mongoose documents before passing them to `io.emit()` or `socket.emit()`. Example: `io.to(room).emit('new_message', message.toJSON());`

## 2. Stale Closures in React Socket Event Listeners
**Symptom**: Real-time events arrive, but they interact with outdated state or variables within the event listener function.
**Root Cause**: Registering `socket.on` inside a `useEffect` hook without providing the necessary dependencies or without cleaning up the old listener leads to stale closures.
**Fix/Prevention**: Always ensure `socket.off('event', handler)` is called in the `useEffect` cleanup function. Additionally, ensure that the `useEffect` dependency array includes all state variables referenced by the handler.

## 3. Real-time Unread Badge Desync
**Symptom**: Unread notification or message counts do not reflect the true state after a user interacts with the app (e.g., opening a chat).
**Root Cause**: Local state updates (e.g., `setUnreadMessages(prev => prev + 1)`) via socket listeners race against global fetches (e.g., `fetchCounts()`) triggered by marking items as read.
**Fix/Prevention**: When an item is marked as read, trigger a global re-fetch from the database, and ensure socket event handlers are idempotent or gracefully handle rapid state transitions.
