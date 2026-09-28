import { Plugin } from '@nestjs/apollo';
import type { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { ConfigService } from '@nestjs/config';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';
import type { AppConfig } from '../config/env.js';

/**
 * Rejects expensive queries before execution. Each field costs 1 by default;
 * list fields declare their own cost (e.g. `tasks` multiplies by `page.first`),
 * so a client can't request 100 tasks × comments × activity × … in one go.
 */
@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  private readonly max: number;

  constructor(
    private readonly schemaHost: GraphQLSchemaHost,
    config: ConfigService<AppConfig, true>,
  ) {
    this.max = config.get('GRAPHQL_MAX_COMPLEXITY', { infer: true });
  }

  async requestDidStart(): Promise<GraphQLRequestListener<object>> {
    const { schema } = this.schemaHost;
    const max = this.max;
    return {
      async didResolveOperation({ request, document }) {
        const complexity = getComplexity({
          schema,
          query: document,
          operationName: request.operationName,
          variables: request.variables,
          estimators: [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })],
        });
        if (complexity > max) {
          throw new GraphQLError(
            `Query is too complex: ${complexity}. Maximum allowed complexity is ${max}.`,
            { extensions: { code: 'QUERY_TOO_COMPLEX', details: { complexity, max } } },
          );
        }
      },
    };
  }
}
