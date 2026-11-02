{# Use the folder schema names as is (staging, marts, metrics, publish). #}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {{ custom_schema_name or target.schema }}
{%- endmacro %}
