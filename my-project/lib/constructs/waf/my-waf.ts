import { RemovalPolicy, Stack, Names } from "aws-cdk-lib";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
  CfnRuleGroup,
  CfnWebACL,
  CfnIPSet,
  CfnLoggingConfiguration,
} from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";
import { WafIpSets } from "./utils/ipsets";
import { WafStatements } from "./utils/statements";

// 以下の記事のgithubリポジトリのコードを大幅リファクタしたもの
// https://zenn.dev/lea/articles/a2bfef8bdbb2e0

type listOfRules = {
  name: string;
  // if not specified, priority is automatically assigned.
  priority?: number;
  overrideAction: string;
  excludedRules: string[];
  // ex: scopeDownStatement: WafStatements.not(WafStatements.startsWithURL("/admin")),
  scopeDownStatement?: CfnWebACL.StatementProperty;
};

/**
 * Defines a WAF configuration.
 * This class creates WAF rules and a Web ACL based on provided configurations.
 * ref: https://github.com/aws-samples/aws-cdk-examples/blob/master/typescript/waf/waf-cloudfront.ts
 */
export class Waf extends Construct {
  readonly webAclId?: string;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // "CLOUDFRONT" か "REGIONAL" を指定
    const webAclScope = "CLOUDFRONT";

    const stack = Stack.of(this);
    const stackId = Names.uniqueResourceName(this, {}).toLowerCase();
    const region = stack.region;

    const logGroup = new LogGroup(this, "WafLogGroup", {
      // TODO: なんかロググループはこの名前じゃないとエラーになるので調査
      logGroupName: `aws-waf-logs-${stackId}-${region}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const wafAcl = new CfnWebACL(this, "WafCloudFront", {
      defaultAction: { allow: {} },
      scope: webAclScope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "waf-cloudfront",
        sampledRequestsEnabled: true,
      },
      rules: this.makeRules(),
    });

    new CfnLoggingConfiguration(this, "WafLogging", {
      resourceArn: wafAcl.attrArn,
      logDestinationConfigs: [logGroup.logGroupArn],
    });
    this.webAclId = wafAcl.attrArn;
  }

  // Generates an array of rule properties for the WAF ACL based on the configuration.
  private makeRules = () => {
    let rules: CfnRuleGroup.RuleProperty[] = [];

    const pushRules = (
      rules: CfnRuleGroup.RuleProperty[],
      newRules: CfnRuleGroup.RuleProperty[]
    ) => [...rules, ...newRules];

    // --- AWS ManagedRules ---
    const managedRules: listOfRules[] = [
      {
        name: "AWSManagedRulesCommonRuleSet",
        overrideAction: "none",
        excludedRules: ["SizeRestrictions_BODY", "CrossSiteScripting_BODY"],
      },
      {
        name: "AWSManagedRulesAmazonIpReputationList",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesAnonymousIpList",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesLinuxRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
      {
        name: "AWSManagedRulesSQLiRuleSet",
        overrideAction: "none",
        excludedRules: [],
      },
    ];
    const managedRuleGroups = this.createManagedRules(
      managedRules,
      rules.length
    );
    rules = pushRules(rules, managedRuleGroups);

    // --- Rate Based Rule ---
    const limitRateRequestsRule = this.createRuleLimitRequests(
      rules.length,
      1000
    );
    rules = pushRules(rules, [limitRateRequestsRule]);

    // --- allows requests from specific IPs ---
    const adminIpRule = this.createSizeRestrictionExcludedAdminIps(
      rules.length,
      new WafIpSets(this, "adminIpsSetList", {
        namePrefix: "Admin",
        ipv4List: ["192.0.2.0/24"],
        ipv6List: ["2001:db8::/32"],
        webAclScope: "CLOUDFRONT",
      }).ipSetList
    );
    rules = pushRules(rules, [adminIpRule]);

    // --- IP Block Rule ---
    const blockUnlistedIps = this.createRuleBlockUnlistedIps(
      rules.length,
      new WafIpSets(this, "BlockNonSpecificIpsRule", {
        namePrefix: "BlockNonSpecificIpsRule",
        ipv4List: ["192.0.3.0/24"],
        webAclScope: "CLOUDFRONT",
      }).ipSetList
    );
    rules = pushRules(rules, [blockUnlistedIps]);

    // --- Geo Based Rule ---
    const geoMatchRule = this.createRuleBlockOutsideAllowedCountries(
      rules.length,
      ["JP", "US"]
    );
    rules = pushRules(rules, [geoMatchRule]);

    // --- custom rule ---
    const XsslabelMatchRule = this.createRuleXSSLabelMatch(
      rules.length,
      new WafIpSets(this, "xssAdminIpsSetList", {
        namePrefix: "Admin",
        ipv4List: [],
        ipv6List: [],
        webAclScope: "CLOUDFRONT",
      }).ipSetList
    );
    rules = pushRules(rules, [XsslabelMatchRule]);

    return rules;
  };

  // TODO: パス名とか16KBとか設定値が入っているので分離
  private createSizeRestrictionExcludedAdminIps(
    priority: number,
    adminIpsSetList: CfnIPSet[]
  ) {
    const urlConditons = WafStatements.or(
      WafStatements.startsWithURL("/api/"),
      WafStatements.exactlyURL("/setup")
    );
    const combinedConditions =
      adminIpsSetList.length === 0
        ? urlConditons
        : WafStatements.and(
            urlConditons,
            WafStatements.ipv4v6Match(adminIpsSetList)
          );
    return WafStatements.block(
      "SizeRestriction",
      priority,
      WafStatements.and(
        WafStatements.oversizedRequestBody(16 * 1024), // 16KB
        WafStatements.not(combinedConditions)
      )
    );
  }

  private createRuleLimitRequests = (priority: number, rateByIp: number) =>
    WafStatements.block(
      "RateLimitRequests",
      priority,
      WafStatements.rateBasedByIp(rateByIp)
    );

  private createRuleBlockUnlistedIps = (
    priority: number,
    blockUnlistedIpsSetList: CfnIPSet[]
  ) =>
    WafStatements.block(
      "BlockUnlistedIps",
      priority,
      WafStatements.not(WafStatements.ipv4v6Match(blockUnlistedIpsSetList))
    );

  private createRuleBlockOutsideAllowedCountries = (
    priority: number,
    countryCodes: string[]
  ) =>
    WafStatements.block(
      "BlockOutsideAllowedCountries",
      priority,
      WafStatements.not(WafStatements.matchCountryCodes(countryCodes))
    );

  // TODO: パス名とかラベル名とか設定値が入っているので分離
  private createRuleXSSLabelMatch = (
    priority: number,
    adminIpsSetList: CfnIPSet[]
  ) => {
    const urlConditons = WafStatements.or(
      WafStatements.startsWithURL("/api/"),
      WafStatements.exactlyURL("/setup")
    );
    const combinedConditions =
      adminIpsSetList.length === 0
        ? urlConditons
        : WafStatements.and(
            urlConditons,
            WafStatements.ipv4v6Match(adminIpsSetList)
          );
    return WafStatements.block(
      "XssLabelMatch",
      priority,
      WafStatements.and(
        WafStatements.matchLabel(
          "LABEL",
          "awswaf:managed:aws:core-rule-set:CrossSiteScripting_Body"
        ),
        WafStatements.not(combinedConditions)
      )
    );
  };

  // aws managed rules
  private createManagedRules = (
    managedRules: listOfRules[],
    startPriorityNumber: number
  ) => {
    return managedRules.map((rule, index) =>
      WafStatements.managedRuleGroup(rule, startPriorityNumber, index)
    );
  };
}
