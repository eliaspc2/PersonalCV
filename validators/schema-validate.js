let cachedSchema = null;

async function loadSchema() {
    if (cachedSchema) return cachedSchema;
    const response = await fetch('schema/cv.schema.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Não foi possível carregar o schema.');
    }
    cachedSchema = await response.json();
    return cachedSchema;
}

function isType(value, type) {
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'boolean') return typeof value === 'boolean';
    return true;
}

function validateNode(schema, data, path, errors) {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type && !isType(data, schema.type)) {
        errors.push({
            path,
            code: 'type',
            expected: schema.type,
            actual: Array.isArray(data) ? 'array' : typeof data
        });
        return;
    }

    if (schema.type === 'object') {
        const required = schema.required || [];
        required.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(data || {}, key)) {
                errors.push({
                    path: `${path}.${key}`,
                    code: 'required'
                });
            }
        });
        const props = schema.properties || {};
        Object.entries(props).forEach(([key, childSchema]) => {
            if (data && Object.prototype.hasOwnProperty.call(data, key)) {
                validateNode(childSchema, data[key], `${path}.${key}`, errors);
            }
        });
        if (schema.additionalProperties && schema.additionalProperties.type) {
            Object.entries(data || {}).forEach(([key, value]) => {
                if (!props[key]) {
                    validateNode(schema.additionalProperties, value, `${path}.${key}`, errors);
                }
            });
        }
    }

    if (schema.type === 'array') {
        if (schema.minItems !== undefined && Array.isArray(data) && data.length < schema.minItems) {
            errors.push({
                path,
                code: 'minItems'
            });
        }
        if (schema.items && Array.isArray(data)) {
            data.forEach((item, index) => {
                validateNode(schema.items, item, `${path}[${index}]`, errors);
            });
        }
    }
}

export async function validateCVSchema(data) {
    const schema = await loadSchema();
    const errors = [];
    validateNode(schema, data, '$', errors);
    return {
        valid: errors.length === 0,
        errors
    };
}
