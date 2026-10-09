with open('app/main.py', 'r') as f:
    content = f.read()

imports = """
from app.api.routes.conversations import router as conversations_router
from app.api.routes.customers import router as customers_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.services import router as services_router
from app.api.routes.dashboard import router as dashboard_router
"""

includes = """
app.include_router(conversations_router)
app.include_router(customers_router)
app.include_router(bookings_router)
app.include_router(services_router)
app.include_router(dashboard_router)
"""

content = content.replace("from app.api.routes.conversations import router as conversations_router\napp.include_router(conversations_router)", f"{imports}\n{includes}")

with open('app/main.py', 'w') as f:
    f.write(content)
