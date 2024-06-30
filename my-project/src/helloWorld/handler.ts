export const handler = async function (event: any, context: any) {
  return {
    statusCode: 200,
    headers: {},
    body: { message: "Hello World!" },
  };
};
