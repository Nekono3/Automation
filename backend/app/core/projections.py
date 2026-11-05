from app.core.permissions import has

FINANCIAL_FIELDS = {
    "contract_amount",
    "paid_amount",
    "remaining_amount",
    "seller_commission_paid",
    "mentor_commission_paid",
    "next_payment_condition",
    "last_payment_date",
    "finance_comment",
    "full_payment_received",
}


def student_view(student, user):
    data = {c.name: getattr(student, c.name) for c in student.__table__.columns}
    if not has(user, "finance.read"):
        for key in FINANCIAL_FIELDS:
            data[key] = None
    return data
