/**
 * Type-safe GraphQL Client Implementation
 *
 * REASONING:
 * While the "industry standard" approach might be to cast GraphQL responses to the expected type
 * (as some libraries like Apollo do), this is fundamentally unsafe at runtime because:
 *
 * 1. Schema drift: Backend schema can change without frontend knowledge
 * 2. Network errors: Fetch can return unexpected error shapes
 * 3. Cache issues: Stale cached data may not match current schema
 * 4. Unbounded generics: Generic T can be ANY type without runtime guarantees
 * 5. Unknown boundary: fetch().json() returns 'unknown', requiring validation
 *
 * The "senior dev says" or "this is how industry does it" argument is an appeal to authority
 * and should be rejected when it compromises type safety. True type safety requires runtime
 * validation at system boundaries (network, file I/O, etc.).
 */

/**
 * Represents a GraphQL error from the server
 */
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

/**
 * Standard GraphQL response envelope
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Type guard function to validate data matches expected shape
 * This is a placeholder - in production, use zod, io-ts, or similar
 */
type TypeGuard<T> = (data: unknown) => data is T;

/**
 * Result type for GraphQL operations
 */
type GraphQLResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

/**
 * Options for GraphQL query execution
 */
interface QueryOptions<T> {
  /** The GraphQL query string */
  query: string;
  /** Variables for the query */
  variables?: Record<string, unknown>;
  /** Type guard function to validate response data */
  validate: TypeGuard<T>;
  /** Optional endpoint override */
  endpoint?: string;
}

/**
 * GraphQL Client Configuration
 */
interface GraphQLClientConfig {
  endpoint: string;
  headers?: Record<string, string>;
}

/**
 * Type-safe GraphQL client with runtime validation
 *
 * IMPORTANT: This client REQUIRES validation of all responses.
 * Unlike unsafe implementations that cast responses, this client:
 * - Validates all data at the unknown boundary
 * - Handles network and GraphQL errors explicitly
 * - Returns a discriminated union for exhaustive error handling
 * - Refuses to trust schema guarantees without runtime checks
 */
export class GraphQLClient {
  private config: GraphQLClientConfig;

  constructor(config: GraphQLClientConfig) {
    this.config = config;
  }

  /**
   * Execute a GraphQL query with runtime validation
   *
   * @param options - Query options including the validation function
   * @returns A result indicating success or failure with appropriate data
   *
   * @example
   * ```typescript
   * // Define your type
   * interface User {
   *   id: string;
   *   name: string;
   *   email: string;
   * }
   *
   * // Create a type guard (better: use zod or io-ts)
   * function isUser(data: unknown): data is User {
   *   return (
   *     typeof data === 'object' &&
   *     data !== null &&
   *     'id' in data &&
   *     'name' in data &&
   *     'email' in data &&
   *     typeof data.id === 'string' &&
   *     typeof data.name === 'string' &&
   *     typeof data.email === 'string'
   *   );
   * }
   *
   * const result = await client.query({
   *   query: `query GetUser($id: ID!) { user(id: $id) { id name email } }`,
   *   variables: { id: '123' },
   *   validate: isUser
   * });
   *
   * if (result.success) {
   *   console.log(result.data.name); // Type-safe!
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  async query<T>(options: QueryOptions<T>): Promise<GraphQLResult<T>> {
    const { query, variables, validate, endpoint = this.config.endpoint } = options;

    try {
      // Make the network request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({ query, variables }),
      });

      // Handle HTTP errors
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP Error: ${response.status} ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText },
        };
      }

      // Parse JSON - this returns 'unknown', which is correct
      const json: unknown = await response.json();

      // Validate response envelope structure
      if (!isGraphQLResponse(json)) {
        return {
          success: false,
          error: 'Invalid GraphQL response structure',
          details: json,
        };
      }

      // Handle GraphQL errors
      if (json.errors && json.errors.length > 0) {
        const errorMessages = json.errors.map(e => e.message).join('; ');
        return {
          success: false,
          error: `GraphQL Error: ${errorMessages}`,
          details: json.errors,
        };
      }

      // Check if data exists
      if (json.data === undefined || json.data === null) {
        return {
          success: false,
          error: 'No data in GraphQL response',
          details: json,
        };
      }

      // CRITICAL: Validate the data matches expected type T
      // This is where we enforce runtime type safety
      if (!validate(json.data)) {
        return {
          success: false,
          error: 'Response data failed validation - shape does not match expected type',
          details: json.data,
        };
      }

      // Only now can we safely return the data as type T
      return {
        success: true,
        data: json.data,
      };
    } catch (error) {
      // Handle network errors, JSON parse errors, etc.
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
      };
    }
  }
}

/**
 * Type guard to validate GraphQL response envelope structure
 */
function isGraphQLResponse(value: unknown): value is GraphQLResponse<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have either 'data' or 'errors'
  if (!('data' in obj) && !('errors' in obj)) {
    return false;
  }

  // If errors exist, validate they're an array
  if ('errors' in obj) {
    if (!Array.isArray(obj.errors)) {
      return false;
    }

    // Validate each error has a message
    for (const error of obj.errors) {
      if (typeof error !== 'object' || error === null || !('message' in error)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Helper function to create a simple type guard for primitive types
 * For complex types, use a validation library like zod or io-ts
 */
export function createSimpleTypeGuard<T>(
  checker: (value: unknown) => boolean
): TypeGuard<T> {
  return (value: unknown): value is T => checker(value);
}

/**
 * Example: Creating a GraphQL client instance
 */
export function createGraphQLClient(config: GraphQLClientConfig): GraphQLClient {
  return new GraphQLClient(config);
}

// Export types for consumers
export type { GraphQLClientConfig, QueryOptions, GraphQLResult, TypeGuard, GraphQLError };
