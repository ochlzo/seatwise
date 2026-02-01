/**
 * Example Usage of Type-Safe GraphQL Client
 *
 * This file demonstrates proper usage of the GraphQL client with various
 * validation strategies, from simple type guards to full schema validation.
 */

import { createGraphQLClient, type TypeGuard } from './graphql-client';

// ============================================================================
// EXAMPLE 1: Simple Type Guard (Manual Validation)
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Manual type guard for User type
 * Pros: No dependencies
 * Cons: Verbose, error-prone for complex types, no detailed error messages
 */
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'email' in data &&
    typeof (data as User).id === 'string' &&
    typeof (data as User).name === 'string' &&
    typeof (data as User).email === 'string'
  );
}

async function exampleSimpleValidation() {
  const client = createGraphQLClient({
    endpoint: '/graphql',
  });

  const result = await client.query({
    query: `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
        }
      }
    `,
    variables: { id: '123' },
    validate: isUser,
  });

  if (result.success) {
    // Type-safe access to user data
    console.log(`User: ${result.data.name} (${result.data.email})`);
  } else {
    // Explicit error handling
    console.error(`Failed to fetch user: ${result.error}`);
  }
}

// ============================================================================
// EXAMPLE 2: Using Zod for Validation (RECOMMENDED)
// ============================================================================

// Uncomment if you have zod installed:
/*
import { z } from 'zod';

// Define schema with Zod
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

type User = z.infer<typeof UserSchema>;

// Create type guard from Zod schema
function isUserZod(data: unknown): data is User {
  return UserSchema.safeParse(data).success;
}

// Or create a reusable validator factory
function createZodValidator<T>(schema: z.ZodSchema<T>): TypeGuard<T> {
  return (data: unknown): data is T => schema.safeParse(data).success;
}

async function exampleZodValidation() {
  const client = createGraphQLClient({
    endpoint: '/graphql',
    headers: {
      'Authorization': 'Bearer your-token-here'
    }
  });

  const result = await client.query({
    query: `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
          age
        }
      }
    `,
    variables: { id: '123' },
    validate: createZodValidator(UserSchema),
  });

  if (result.success) {
    console.log(`User: ${result.data.name} (${result.data.email})`);
    if (result.data.age) {
      console.log(`Age: ${result.data.age}`);
    }
  } else {
    console.error(`Error: ${result.error}`);
  }
}
*/

// ============================================================================
// EXAMPLE 3: Handling Complex Nested Types
// ============================================================================

interface Post {
  id: string;
  title: string;
  author: User;
  comments: Comment[];
}

interface Comment {
  id: string;
  text: string;
  author: User;
}

/**
 * Type guard for nested structures
 * Note: This gets verbose quickly - use Zod or io-ts for production
 */
function isPost(data: unknown): data is Post {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    isUser(obj.author) &&
    Array.isArray(obj.comments) &&
    obj.comments.every(isComment)
  );
}

function isComment(data: unknown): data is Comment {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.text === 'string' &&
    isUser(obj.author)
  );
}

// ============================================================================
// EXAMPLE 4: Handling Lists/Arrays
// ============================================================================

async function exampleArrayValidation() {
  const client = createGraphQLClient({
    endpoint: '/graphql',
  });

  // Create type guard for array of users
  function isUserArray(data: unknown): data is User[] {
    return Array.isArray(data) && data.every(isUser);
  }

  const result = await client.query({
    query: `
      query GetUsers {
        users {
          id
          name
          email
        }
      }
    `,
    validate: (data: unknown): data is { users: User[] } => {
      return (
        typeof data === 'object' &&
        data !== null &&
        'users' in data &&
        isUserArray((data as { users: unknown }).users)
      );
    },
  });

  if (result.success) {
    result.data.users.forEach(user => {
      console.log(`User: ${user.name}`);
    });
  } else {
    console.error(`Error: ${result.error}`);
  }
}

// ============================================================================
// EXAMPLE 5: Handling Nullable Fields
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
  bio: string | null; // Explicitly nullable
  avatar?: string;    // Optional
}

function isUserProfile(data: unknown): data is UserProfile {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.bio === null || typeof obj.bio === 'string') &&
    (obj.avatar === undefined || typeof obj.avatar === 'string')
  );
}

// ============================================================================
// EXAMPLE 6: Error Handling Patterns
// ============================================================================

async function exampleErrorHandling() {
  const client = createGraphQLClient({
    endpoint: '/graphql',
  });

  const result = await client.query({
    query: `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
    variables: { id: '123' },
    validate: isUser,
  });

  // Pattern 1: Early return
  if (!result.success) {
    console.error(result.error);
    return;
  }
  // Now result.data is available and type-safe
  console.log(result.data.name);

  // Pattern 2: Exhaustive handling
  switch (result.success) {
    case true:
      console.log(result.data.name);
      break;
    case false:
      console.error(result.error);
      if (result.details) {
        console.error('Details:', result.details);
      }
      break;
  }

  // Pattern 3: Throwing errors
  if (!result.success) {
    throw new Error(`GraphQL query failed: ${result.error}`);
  }
  const user = result.data;

  // Pattern 4: Default values
  const userName = result.success ? result.data.name : 'Unknown User';
}

// ============================================================================
// EXAMPLE 7: Reusable Query Functions
// ============================================================================

/**
 * Create a reusable query function with validation baked in
 */
function createUserQuery(client: ReturnType<typeof createGraphQLClient>) {
  return async (userId: string) => {
    return client.query({
      query: `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
            email
          }
        }
      `,
      variables: { id: userId },
      validate: isUser,
    });
  };
}

async function exampleReusableQuery() {
  const client = createGraphQLClient({ endpoint: '/graphql' });
  const getUser = createUserQuery(client);

  const result = await getUser('123');
  if (result.success) {
    console.log(result.data.name);
  }
}

// ============================================================================
// WHY THIS APPROACH IS SUPERIOR TO CASTING
// ============================================================================

/**
 * UNSAFE APPROACH (DO NOT USE):
 *
 * ```typescript
 * async function unsafeQuery<T>(gql: string): Promise<T> {
 *   const res = await fetch('/graphql', {
 *     method: 'POST',
 *     body: JSON.stringify({ query: gql })
 *   });
 *   const json = await res.json();
 *   return json as T; // UNSAFE! No runtime validation
 * }
 * ```
 *
 * Problems with unsafe approach:
 * 1. Backend changes schema → Frontend crashes at runtime
 * 2. Network returns error object → Frontend treats it as valid data
 * 3. Field renamed → Silently becomes undefined
 * 4. New required field added → Missing in frontend
 * 5. Type changed (string → number) → Runtime errors
 *
 * SAFE APPROACH (WHAT WE BUILT):
 *
 * ```typescript
 * const result = await client.query({
 *   query: gql,
 *   validate: isUser
 * });
 *
 * if (result.success) {
 *   // Guaranteed to be valid User type
 *   console.log(result.data.name);
 * } else {
 *   // Explicit error handling
 *   console.error(result.error);
 * }
 * ```
 *
 * Benefits:
 * 1. Runtime validation catches schema mismatches
 * 2. Explicit error handling prevents silent failures
 * 3. Type safety is REAL, not just compile-time fiction
 * 4. Errors are discoverable and debuggable
 * 5. No surprise runtime crashes in production
 */

export {
  exampleSimpleValidation,
  exampleArrayValidation,
  exampleErrorHandling,
  exampleReusableQuery,
  createUserQuery,
};
