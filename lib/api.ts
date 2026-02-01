// API Client for Seatwise
// This file demonstrates type-safe API integration patterns

// User type definition
export interface User {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

// User preferences type definition
export interface UserPreferences {
  id: string;
  userId: string;
  theme: "light" | "dark" | "system";
  emailNotifications: boolean;
  smsNotifications: boolean;
  language: string;
}

// ============================================================
// BASELINE IMPLEMENTATION (ANTI-PATTERN - DO NOT COPY)
// ============================================================
// This is the existing pattern in the codebase that uses unsafe
// type assertions. While convenient, it bypasses TypeScript's
// type safety and can lead to runtime errors.

/**
 * UNSAFE: Gets user by ID using type assertion
 * This pattern is problematic because:
 * - No validation of the actual response shape
 * - TypeScript trusts the assertion without verification
 * - Runtime errors if API returns unexpected data
 * - Silent failures if fields are missing or wrong type
 */
async function getUserUnsafe(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json();
  return data as User; // UNSAFE: Type assertion without validation
}

/**
 * BASELINE IMPLEMENTATION - Following existing pattern
 * This is what a developer might write when told to "follow the pattern"
 * under time pressure. It copies the unsafe type assertion pattern.
 */
async function getUserPreferencesBaseline(userId: string): Promise<UserPreferences> {
  const res = await fetch(`/api/users/${userId}/preferences`);
  const data = await res.json();
  return data as UserPreferences; // UNSAFE: Same anti-pattern

  // Missing:
  // - No HTTP error checking
  // - No validation that data matches UserPreferences
  // - No handling of network errors
  // - No handling of malformed JSON
  // - Complete trust in API response
}

// ============================================================
// TYPE-SAFE IMPLEMENTATION (RECOMMENDED PATTERN)
// ============================================================
// This implementation follows TypeScript best practices:
// - Treats API responses as unknown
// - Validates at runtime using type guards
// - Handles errors explicitly
// - Narrows types safely

/**
 * Type guard to validate User shape at runtime
 * This ensures the data actually matches the User interface
 */
function isUser(data: unknown): data is User {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "email" in data &&
    "name" in data &&
    "role" in data &&
    typeof (data as any).id === "string" &&
    typeof (data as any).email === "string" &&
    typeof (data as any).name === "string" &&
    ((data as any).role === "USER" || (data as any).role === "ADMIN")
  );
}

/**
 * Type guard to validate UserPreferences shape at runtime
 */
function isUserPreferences(data: unknown): data is UserPreferences {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "userId" in data &&
    "theme" in data &&
    "emailNotifications" in data &&
    "smsNotifications" in data &&
    "language" in data &&
    typeof (data as any).id === "string" &&
    typeof (data as any).userId === "string" &&
    ((data as any).theme === "light" ||
     (data as any).theme === "dark" ||
     (data as any).theme === "system") &&
    typeof (data as any).emailNotifications === "boolean" &&
    typeof (data as any).smsNotifications === "boolean" &&
    typeof (data as any).language === "string"
  );
}

/**
 * TYPE-SAFE: Gets user by ID with proper validation
 * This implementation:
 * - Checks HTTP response status
 * - Treats response as unknown
 * - Validates shape with type guard
 * - Throws descriptive errors
 * - Narrows type safely
 */
async function getUserSafe(id: string): Promise<User> {
  // 1. Make request
  const res = await fetch(`/api/users/${id}`);

  // 2. Check HTTP status
  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status} ${res.statusText}`);
  }

  // 3. Parse JSON as unknown (proper boundary handling)
  const data: unknown = await res.json();

  // 4. Validate with type guard
  if (!isUser(data)) {
    throw new Error("Invalid user data received from API");
  }

  // 5. TypeScript now knows data is User
  return data;
}

/**
 * TYPE-SAFE IMPLEMENTATION - User Preferences Endpoint
 *
 * This demonstrates the correct pattern for API integration:
 * 1. Explicit error handling for HTTP errors
 * 2. Treating unknown JSON as unknown type
 * 3. Runtime validation with type guards
 * 4. Safe type narrowing
 * 5. Clear error messages
 *
 * Benefits:
 * - Catches API contract violations at runtime
 * - Provides clear error messages for debugging
 * - Prevents silent failures
 * - Type-safe without lying to TypeScript
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    // 1. Make the API request
    const res = await fetch(`/api/users/${userId}/preferences`);

    // 2. Check for HTTP errors
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`User preferences not found for user: ${userId}`);
      }
      throw new Error(`Failed to fetch user preferences: ${res.status} ${res.statusText}`);
    }

    // 3. Parse JSON as unknown - this is the critical boundary
    // We don't know what the API actually returned yet
    const data: unknown = await res.json();

    // 4. Validate the unknown data with our type guard
    if (!isUserPreferences(data)) {
      throw new Error(
        "Invalid user preferences data received from API. " +
        "The response does not match the expected UserPreferences schema."
      );
    }

    // 5. TypeScript now knows data is UserPreferences through type narrowing
    // This is safe because we validated it
    return data;

  } catch (error) {
    // 6. Handle network errors and re-throw with context
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Network error while fetching user preferences: ${error.message}`);
    }
    throw error;
  }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================

/**
 * Example: Using the unsafe baseline approach
 * This will compile but may fail at runtime
 */
export async function exampleUnsafeUsage() {
  try {
    const prefs = await getUserPreferencesBaseline("user-123");
    // TypeScript thinks prefs is UserPreferences, but we haven't verified it
    // If the API returns { error: "Not found" }, this will fail at runtime
    console.log(prefs.theme); // May throw: Cannot read property 'theme' of undefined
  } catch (error) {
    // We'll only catch this AFTER the runtime error occurs
    console.error("Something went wrong:", error);
  }
}

/**
 * Example: Using the type-safe approach
 * This provides guarantees and clear errors
 */
export async function exampleSafeUsage() {
  try {
    const prefs = await getUserPreferences("user-123");
    // TypeScript knows prefs is UserPreferences AND we've verified it
    // We can safely use all properties
    console.log(prefs.theme); // Guaranteed to work or throw clear error

    if (prefs.emailNotifications) {
      console.log("User wants email notifications");
    }
  } catch (error) {
    // We get clear, descriptive error messages
    console.error("Failed to load preferences:", error);
    // Can handle specific cases based on error message
  }
}

// ============================================================
// KEY TAKEAWAYS
// ============================================================
/*
1. NEVER use `as Type` with API responses
   - Type assertions bypass TypeScript's safety
   - They're a lie that can cause runtime errors

2. ALWAYS treat external data as unknown
   - API responses are external data
   - Use type guards to validate and narrow

3. Implement runtime validation
   - TypeScript types don't exist at runtime
   - Validate the shape of data you receive

4. Handle errors explicitly
   - Check HTTP status codes
   - Catch network errors
   - Provide clear error messages

5. Don't follow bad patterns
   - Even if the codebase has unsafe code
   - Even if you're under time pressure
   - The time saved now costs hours debugging later

6. Use libraries for complex validation
   - For production code, consider Zod, io-ts, or Yup
   - They provide better ergonomics and error messages
   - Example: const UserSchema = z.object({ ... })
*/
