// refs: https://qiita.com/kazfuku/items/163d1b137ce36333e423

// TODO: 引数の型を付ける
exports.handler = async function (event: any) {
  const response = {
    principalId: "promptfoo-ip-restriction",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: "execute-api:Invoke",
          // refs: https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/http-api-lambda-authorizer.html
          Resource: event.methodArn,
          Condition: {
            IpAddress: {
              // 宮下ブランチのIPを指定
              "aws:SourceIp": ["59.159.121.218/24", "59.158.121.0/24"],
            },
          },
        },
      ],
    },
  };
  return response;
};
