import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    logger.debug(f"Received event: {event}")
    logger.debug(f"Received context: {context}")
    json_region = os.environ["AWS_REGION"]
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"Region ": json_region}),
    }
