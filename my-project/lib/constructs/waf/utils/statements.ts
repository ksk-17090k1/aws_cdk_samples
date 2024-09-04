import { CfnRuleGroup, CfnWebACL, CfnIPSet } from "aws-cdk-lib/aws-wafv2";

type listOfRules = {
  name: string;
  priority?: number;
  overrideAction: string;
  excludedRules: string[];
  scopeDownStatement?: CfnWebACL.StatementProperty;
};
type LabelScope = "LABEL" | "NAMESPACE";

export class WafStatements {
  static block = (
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty
  ) => this.ruleAction(name, priority, statement, { block: {} });

  static allow = (
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty
  ) => this.ruleAction(name, priority, statement, { allow: {} });

  static ruleAction = (
    name: string,
    priority: number,
    statement: CfnWebACL.StatementProperty,
    action?: CfnRuleGroup.RuleActionProperty
  ): CfnRuleGroup.RuleProperty => {
    return {
      name: name,
      priority: priority,
      statement: statement,
      action: action,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: name,
      },
    };
  };

  static not = (
    statement: CfnWebACL.StatementProperty
  ): CfnWebACL.StatementProperty => {
    return {
      notStatement: {
        statement: statement,
      },
    };
  };

  static and = (
    ...statements: CfnWebACL.StatementProperty[]
  ): CfnWebACL.StatementProperty => {
    if (statements.length === 1) {
      return statements[0];
    }
    return {
      andStatement: {
        statements: statements,
      },
    };
  };

  static or = (
    ...statements: CfnWebACL.StatementProperty[]
  ): CfnWebACL.StatementProperty => {
    if (statements.length === 1) {
      return statements[0];
    }
    return {
      orStatement: {
        statements: statements,
      },
    };
  };

  static startsWithURL = (path: string): CfnWebACL.StatementProperty => {
    return {
      byteMatchStatement: {
        fieldToMatch: {
          uriPath: {},
        },
        positionalConstraint: "STARTS_WITH",
        searchString: path,
        textTransformations: [
          {
            priority: 0,
            type: "NONE",
          },
        ],
      },
    };
  };

  static exactlyURL = (path: string): CfnWebACL.StatementProperty => {
    return {
      byteMatchStatement: {
        fieldToMatch: {
          uriPath: {},
        },
        positionalConstraint: "EXACTLY",
        searchString: path,
        textTransformations: [
          {
            priority: 0,
            type: "NONE",
          },
        ],
      },
    };
  };

  static managedRuleGroup = (
    r: listOfRules,
    startPriorityNumber: number,
    index: number
  ): CfnRuleGroup.RuleProperty => {
    const stateProp: CfnWebACL.StatementProperty = {
      managedRuleGroupStatement: {
        name: r.name,
        vendorName: "AWS",
        excludedRules: r.excludedRules.map((ruleName) => ({
          name: ruleName,
        })),
        scopeDownStatement: r.scopeDownStatement,
      },
    };
    const overrideAction: CfnWebACL.OverrideActionProperty = { none: {} };
    const rule = {
      name: r.name,
      priority:
        r.priority !== undefined ? r.priority : startPriorityNumber + index,
      overrideAction: overrideAction,
      statement: stateProp,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: r.name,
      },
    };
    return rule;
  };

  static oversizedRequestBody = (size: number): CfnWebACL.StatementProperty => {
    return {
      sizeConstraintStatement: {
        fieldToMatch: {
          body: {},
        },
        comparisonOperator: "GT",
        size: size,
        textTransformations: [
          {
            priority: 0,
            type: "NONE",
          },
        ],
      },
    };
  };

  static rateBasedByIp = (limit: number): CfnWebACL.StatementProperty => {
    return {
      rateBasedStatement: {
        limit: limit,
        aggregateKeyType: "IP",
      },
    };
  };

  static matchCountryCodes = (
    countryCodes: string[]
  ): CfnWebACL.StatementProperty => {
    return {
      geoMatchStatement: {
        // block connection if source not in the below country list
        countryCodes: countryCodes,
      },
    };
  };

  static matchLabel = (
    scope: LabelScope,
    key: string
  ): CfnWebACL.StatementProperty => {
    return {
      labelMatchStatement: {
        scope,
        key,
      },
    };
  };

  static matchIpList = (ipList?: CfnIPSet): CfnWebACL.StatementProperty => {
    if (!ipList) {
      return {};
    }
    return {
      ipSetReferenceStatement: {
        arn: ipList.attrArn,
      },
    };
  };

  static ipv4v6Match = (ipSets: CfnIPSet[]): CfnWebACL.StatementProperty => {
    const ipStatements = ipSets
      .filter((ipSet) => ipSet && ipSet.addresses.length > 0)
      .map((ipSet) => this.matchIpList(ipSet));
    if (ipStatements.length === 0) {
      throw new Error("Both IPv4List and IPv6List are empty or undefined.");
    }
    return this.or(...ipStatements);
  };
}
