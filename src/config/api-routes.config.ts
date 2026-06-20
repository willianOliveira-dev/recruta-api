export const API_PREFIX = 'api';
export const API_VERSION = '1';
export const API_VERSION_SEGMENT = `v${API_VERSION}`;
export const API_BASE_PATH = `/${API_PREFIX}/${API_VERSION_SEGMENT}`;

export const AUTH_ROUTE = 'auth';
export const AUTH_BASE_PATH = `${API_BASE_PATH}/${AUTH_ROUTE}`;
export const AUTH_OPENAPI_SCHEMA_PATH = `${AUTH_BASE_PATH}/open-api/generate-schema`;

export const HEALTH_ROUTE = 'health';
export const HEALTH_BASE_PATH = `${API_BASE_PATH}/${HEALTH_ROUTE}`;

export const DOCS_PATH = 'docs';
export const DOCS_URL = `/${DOCS_PATH}`;
export const OPENAPI_JSON_PATH = 'openapi.json';
export const OPENAPI_YAML_PATH = 'openapi.yaml';
export const OPENAPI_JSON_URL = `/${OPENAPI_JSON_PATH}`;
export const OPENAPI_YAML_URL = `/${OPENAPI_YAML_PATH}`;
