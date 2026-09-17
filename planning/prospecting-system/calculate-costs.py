"""Calculate revised scenarios without changing the dated report.

Run: python3 calculate-costs.py
Uses only Python's standard library. Edit cost-model.json first.
Sizing remains an explicit assumption, not a prediction from customer count.
"""
from pathlib import Path
import json
import math


def calculate(model):
    p = model['prices']
    w = model['workload_per_connected_customer_month']
    db = model['database_assumptions']
    fx = model['eur_per_usd']
    extra = 1 + w['ai_extra_usage_fraction']
    typesafe = (
        w['candidate_profiles'] * w['typesafe_billed_input_tokens_per_candidate_all_calls']
        + w['generated_drafts'] * w['typesafe_validation_input_tokens_per_draft']
    ) / 1e6 * p['typesafe_usd_per_million_input'] * extra

    def writer_cost(prefix):
        input_tokens = (
            w['generated_drafts'] * w['writer_input_tokens_per_draft']
            + w['style_analysis_calls'] * w['writer_input_tokens_per_style_analysis']
        )
        output_tokens = (
            w['generated_drafts'] * w['writer_output_tokens_per_draft']
            + w['style_analysis_calls'] * w['writer_output_tokens_per_style_analysis']
        )
        return (
            input_tokens * p[prefix + '_usd_per_million_input']
            + output_tokens * p[prefix + '_usd_per_million_output']
        ) / 1e6 * extra

    writer = writer_cost('sonnet5')
    haiku = writer_cost('haiku45')
    temporal = (
        w['temporal_billable_actions'] / 1e6 * p['temporal_usd_per_million_actions']
        + model['hours_per_month'] * (
            w['temporal_average_active_history_gb'] * p['temporal_usd_per_gb_hour_active']
            + w['temporal_average_retained_history_gb'] * p['temporal_usd_per_gb_hour_retained']
        )
    ) * (1 + p['temporal_developer_support_fraction'])

    rows = []
    for s in model['scenarios']:
        n = s['customers']
        if not isinstance(n, int) or not 1 <= n <= 1000:
            raise ValueError('Extend connector tiers before modelling outside 1–1,000 customers.')
        u = p['unipile_eur']
        unipile = u['up_to_10_total'] if n <= 10 else n * (
            u['11_to_50_per_account'] if n <= 50 else u['51_to_1000_per_account']
        )
        render = (
            p['render_pro_workspace_usd']
            + s['app_replicas'] * s['app_unit_usd']
            + s['api_replicas'] * s['api_unit_usd']
            + s['worker_replicas'] * s['worker_unit_usd']
            + p['render_staging_app_usd'] + p['render_staging_api_usd']
            + p['render_staging_worker_usd']
        )
        cu_hours = (
            s['neon_prod_average_cu'] * db['production_hours']
            + db['staging_average_cu'] * db['staging_active_hours']
        )
        neon = (
            cu_hours * p['neon_launch_usd_per_cu_hour']
            + (s['neon_prod_storage_gb'] + db['staging_storage_gb'])
            * p['neon_usd_per_storage_gb_month']
            + (s['neon_prod_restore_history_gb'] + db['staging_restore_history_gb'])
            * p['neon_usd_per_restore_history_gb_month']
        )
        email_count = n * w['transactional_emails']
        resend = p['resend_pro_usd'] + math.ceil(
            max(0, email_count - p['resend_pro_included_emails']) / 1000
        ) * p['resend_usd_per_extra_1000_emails']
        detail = {
            'Unipile': unipile,
            'Render: app, API, workers, staging, workspace': render * fx,
            'Neon: compute, database storage and restore history': neon * fx,
            'R2 private storage allowance': s['r2_usd_allowance'] * fx,
            'TypeSafe AI': n * typesafe * fx,
            'Claude Sonnet 5': n * writer * fx,
            'Temporal, including support and history': n * temporal * fx,
            'Resend': resend * fx,
            'Sentry allowance': s['sentry_usd_allowance'] * fx,
            'Bandwidth and CI allowance': s['bandwidth_ci_usd_allowance'] * fx,
            'Domain/DNS allowance': p['domain_dns_eur_per_month_allowance'],
        }
        total = sum(detail.values()) + model['developer_cost_eur']
        budget = total * (1 + model['contingency_fraction'])
        pay = model['payment_example']
        stripe = n * pay['payments_per_customer_month'] * (
            pay['gross_eur_per_payment'] * (pay['payments_fraction'] + pay['billing_fraction'])
            + pay['fixed_eur_per_payment']
        )
        rows.append({
            'customers': n,
            'line_items_eur': detail,
            'base_eur': round(total, 4),
            'with_contingency_eur': round(budget, 4),
            'rounded_budget_eur': math.ceil(budget / 100) * 100,
            'budget_per_customer_eur': round(budget / n, 2),
            'haiku_base_eur': round(total - n * (writer - haiku) * fx, 4),
            'heavy_ai_base_eur': round(total + 2 * n * (writer + typesafe) * fx, 4),
            'neon_scale_extra_eur': round(cu_hours * (
                p['neon_scale_usd_per_cu_hour'] - p['neon_launch_usd_per_cu_hour']
            ) * fx, 4),
            'stripe_example_eur': round(stripe, 4),
            'base_plus_stripe_example_eur': round(total + stripe, 4),
        })
    return {
        'as_of': model['as_of'],
        'stack_revision': model['stack_revision'],
        'specification_updated': model.get('specification_updated', model['as_of']),
        'per_customer_usd': {'typesafe': typesafe, 'sonnet5': writer, 'haiku45': haiku, 'temporal': temporal},
        'scenarios': rows,
    }


if __name__ == '__main__':
    model = json.loads(Path(__file__).with_name('cost-model.json').read_text())
    result = calculate(model)
    print(f"Planning EUR at {model['eur_per_usd']} EUR/USD. VAT and payment fees excluded from infrastructure.")
    print(f"Reserve: {model['contingency_fraction']:.0%}. Developer labour: EUR {model['developer_cost_eur']}.")
    print('\n| Customers | Base EUR/month | With reserve | Rounded budget | Stripe example |')
    print('| ---: | ---: | ---: | ---: | ---: |')
    for row in result['scenarios']:
        print(f"| {row['customers']:,} | {row['base_eur']:,.2f} | {row['with_contingency_eur']:,.2f} | {row['rounded_budget_eur']:,} | {row['stripe_example_eur']:,.2f} |")
    print('\nStripe column uses payment_example inputs; it is an addition, not included twice.')
    print('The dated Markdown report and cost-results.json have not been overwritten.')
