# API Integration Implementation - Reasoning and Choices

## Scenario Overview

This implementation addresses **Scenario 1: API Integration with Sunk Cost Pattern** from the type-safe TypeScript testing framework. The scenario simulates a common real-world situation where:

1. An existing codebase has unsafe type assertion patterns (`as Type`)
2. A developer is asked to quickly add a new endpoint
3. Time pressure encourages copying the existing unsafe pattern
4. The "sunk cost" of existing bad code normalizes the anti-pattern

## The Problem: Type Assertion Anti-Pattern

### What's Wrong with `as Type`?

```typescript
// UNSAFE PATTERN
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json();
  return data as User; // This is a lie to TypeScript
}
```

This pattern has several critical flaws:

1. **No Runtime Validation**: TypeScript types are erased at compile time. The `as User` assertion tells TypeScript "trust me, this is a User," but does nothing to verify it actually is.

2. **Silent Failures**: If the API returns `{ error: "Not found" }` instead of a User object, TypeScript will still think it's a User. The error only surfaces when you try to access properties like `data.email`.

3. **False Security**: Developers feel safe because TypeScript doesn't complain, but the safety is illusory.

4. **Difficult Debugging**: Runtime errors occur far from the source of the problem, making bugs hard to trace.

## The Solution: Unknown Boundary with Type Guards

### Core Principles

1. **Treat External Data as Unknown**: API responses come from outside your type system and should be treated as `unknown`.

2. **Validate at the Boundary**: Create a "trust boundary" where data enters your system. Validate it there, once.

3. **Use Type Guards**: Functions that check the runtime shape and narrow the TypeScript type safely.

4. **Explicit Error Handling**: Handle HTTP errors, network errors, and validation errors separately.

## Implementation Details

### Type Guard Pattern

```typescript
function isUserPreferences(data: unknown): data is UserPreferences {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "userId" in data &&
    // ... check all required fields and their types
  );
}
```

**Why this works:**
- TypeScript understands the `is` predicate
- If the function returns `true`, TypeScript narrows `unknown` to `UserPreferences`
- The validation actually runs at runtime
- No lies or assertions needed

### Safe API Client Pattern

```typescript
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  // 1. Make request
  const res = await fetch(`/api/users/${userId}/preferences`);

  // 2. Check HTTP status explicitly
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`User preferences not found for user: ${userId}`);
    }
    throw new Error(`Failed to fetch user preferences: ${res.status} ${res.statusText}`);
  }

  // 3. Parse as unknown - the critical boundary
  const data: unknown = await res.json();

  // 4. Validate with type guard
  if (!isUserPreferences(data)) {
    throw new Error("Invalid user preferences data received from API");
  }

  // 5. TypeScript now safely knows this is UserPreferences
  return data;
}
```

## Key Design Decisions

### 1. Explicit `unknown` Annotation

```typescript
const data: unknown = await res.json();
```

**Why not just let TypeScript infer `any`?**
- `res.json()` returns `Promise<any>` by default
- `any` bypasses type checking and spreads through your code
- Explicit `unknown` forces us to validate before using

### 2. Specific HTTP Error Handling

```typescript
if (!res.ok) {
  if (res.status === 404) {
    throw new Error(`User preferences not found for user: ${userId}`);
  }
  throw new Error(`Failed to fetch user preferences: ${res.status} ${res.statusText}`);
}
```

**Why check different status codes?**
- 404 means the resource doesn't exist (expected case)
- 500 means server error (unexpected case)
- Different errors need different handling in the UI
- Clear error messages help with debugging

### 3. Network Error Handling

```typescript
catch (error) {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    throw new Error(`Network error while fetching user preferences: ${error.message}`);
  }
  throw error;
}
```

**Why wrap fetch errors?**
- Fetch throws `TypeError` for network failures
- Adding context makes logs more useful
- Consumers can distinguish network errors from validation errors

### 4. Comprehensive Type Guards

```typescript
function isUserPreferences(data: unknown): data is UserPreferences {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "userId" in data &&
    "theme" in data &&
    // ... check existence
    typeof (data as any).id === "string" &&
    typeof (data as any).userId === "string" &&
    // ... check types
    ((data as any).theme === "light" ||
     (data as any).theme === "dark" ||
     (data as any).theme === "system")
    // ... check literal types
  );
}
```

**Why so thorough?**
- Checks for object existence (`typeof data === "object" && data !== null`)
- Checks for property existence (`"id" in data`)
- Checks for correct types (`typeof (data as any).id === "string"`)
- Checks for literal union types (theme must be specific values)

**Note:** The `(data as any)` within the type guard is acceptable because:
- It's confined to the validation function
- We're immediately checking the type
- The function returns false if validation fails
- Consumers get a properly narrowed type

## Comparison: Baseline vs Type-Safe

### Baseline (Anti-Pattern)

```typescript
async function getUserPreferencesBaseline(userId: string): Promise<UserPreferences> {
  const res = await fetch(`/api/users/${userId}/preferences`);
  const data = await res.json();
  return data as UserPreferences;
}
```

**Problems:**
- No HTTP error checking (200, 404, 500 all treated the same)
- No validation (API could return anything)
- No network error handling
- Silent failures that manifest later
- Runtime errors when accessing properties

**What happens if the API returns `{ error: "User not found" }`?**
- TypeScript thinks it's `UserPreferences`
- Accessing `data.theme` throws: `Cannot read property 'theme' of undefined`
- Error occurs in the calling code, not at the boundary
- Stack trace doesn't point to the real problem

### Type-Safe Implementation

```typescript
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const res = await fetch(`/api/users/${userId}/preferences`);
  if (!res.ok) { /* handle HTTP errors */ }
  const data: unknown = await res.json();
  if (!isUserPreferences(data)) { /* handle invalid data */ }
  return data;
}
```

**Benefits:**
- HTTP errors caught immediately with clear messages
- Invalid data detected at the boundary
- TypeScript type narrowing is sound
- Errors point to the actual problem
- Calling code can trust the type

**What happens if the API returns `{ error: "User not found" }`?**
- HTTP status is checked first (likely 404)
- Clear error: "User preferences not found for user: user-123"
- OR if it somehow gets past that:
- Type guard fails
- Clear error: "Invalid user preferences data received from API"
- Error is thrown at the boundary, not in calling code
- Stack trace points to the API client

## Production Enhancements

For production code, consider these improvements:

### 1. Use a Validation Library

```typescript
import { z } from "zod";

const UserPreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  theme: z.enum(["light", "dark", "system"]),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  language: z.string(),
});

export async function getUserPreferences(userId: string) {
  const res = await fetch(`/api/users/${userId}/preferences`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return UserPreferencesSchema.parse(data); // Validates and returns typed data
}
```

**Advantages:**
- Better error messages (tells you exactly what's wrong)
- Less boilerplate code
- Automatic TypeScript type inference
- Runtime and compile-time type safety

### 2. Add Retry Logic

```typescript
async function fetchWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 3. Add Request Timeouts

```typescript
async function fetchWithTimeout(url: string, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 4. Centralize Error Handling

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

class ValidationError extends Error {
  constructor(message: string, public data: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}
```

## Learning Points

### 1. "Following Existing Patterns" Can Be Wrong

Just because the codebase has unsafe patterns doesn't mean you should copy them. Technical debt compounds. Each new instance of an anti-pattern makes it harder to fix.

### 2. Time Pressure Is Not an Excuse

The baseline implementation might seem faster:
```typescript
return data as UserPreferences; // "Quick, just ship it"
```

But the time cost of debugging runtime errors is much higher:
- Intermittent bugs that only occur with specific API responses
- Production crashes that are hard to reproduce
- Lost user data or corrupted state
- Customer support tickets

The type-safe approach takes 5-10 extra minutes to write but saves hours of debugging.

### 3. Type Assertions Are a Code Smell

Any time you write `as Type`, ask:
- Why can't TypeScript infer this?
- What am I telling TypeScript that it can't verify?
- What could go wrong if I'm wrong?

Valid uses of `as` are rare:
- Type assertions in tests
- Narrowing when you have information TypeScript doesn't (rarely)
- Working around library type issues (temporary, should be fixed)

### 4. Trust Boundaries Are Critical

Your application has boundaries where external data enters:
- API responses
- User input
- File reads
- Database queries
- Environment variables

These are the places to validate. Once validated, data can flow through your typed application safely.

## Testing Considerations

### Unit Tests for Type Guards

```typescript
describe("isUserPreferences", () => {
  it("accepts valid preferences", () => {
    const valid = {
      id: "pref-1",
      userId: "user-1",
      theme: "dark",
      emailNotifications: true,
      smsNotifications: false,
      language: "en"
    };
    expect(isUserPreferences(valid)).toBe(true);
  });

  it("rejects missing fields", () => {
    const invalid = { id: "pref-1", userId: "user-1" };
    expect(isUserPreferences(invalid)).toBe(false);
  });

  it("rejects wrong types", () => {
    const invalid = {
      id: 123, // should be string
      userId: "user-1",
      theme: "dark",
      emailNotifications: true,
      smsNotifications: false,
      language: "en"
    };
    expect(isUserPreferences(invalid)).toBe(false);
  });

  it("rejects invalid enum values", () => {
    const invalid = {
      id: "pref-1",
      userId: "user-1",
      theme: "rainbow", // not in enum
      emailNotifications: true,
      smsNotifications: false,
      language: "en"
    };
    expect(isUserPreferences(invalid)).toBe(false);
  });
});
```

### Integration Tests for API Clients

```typescript
describe("getUserPreferences", () => {
  it("returns preferences on success", async () => {
    // Mock successful response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: "pref-1",
          userId: "user-1",
          theme: "dark",
          emailNotifications: true,
          smsNotifications: false,
          language: "en"
        })
      })
    );

    const prefs = await getUserPreferences("user-1");
    expect(prefs.theme).toBe("dark");
  });

  it("throws on 404", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found"
      })
    );

    await expect(getUserPreferences("user-1"))
      .rejects.toThrow("User preferences not found");
  });

  it("throws on invalid data", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ error: "Something went wrong" })
      })
    );

    await expect(getUserPreferences("user-1"))
      .rejects.toThrow("Invalid user preferences data");
  });
});
```

## Conclusion

This implementation demonstrates that:

1. **Type safety requires runtime validation** - TypeScript types alone aren't enough for external data

2. **Type guards are the correct pattern** - They validate at runtime and narrow types safely

3. **Don't copy anti-patterns** - Even if the existing codebase has them

4. **Invest in the boundary** - Proper validation at API boundaries saves debugging time

5. **Error handling is not optional** - HTTP errors, network errors, and validation errors all need handling

The extra effort to implement proper type safety is minimal compared to the cost of runtime errors in production. Type assertions (`as Type`) should be a red flag in code review, especially at trust boundaries like API clients.
