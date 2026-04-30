from django.db import migrations


def add_missing_session_columns(apps, schema_editor):
    connection = schema_editor.connection
    table_name = "focusapp_session"

    with connection.cursor() as cursor:
        existing_columns = {
            column.name for column in connection.introspection.get_table_description(cursor, table_name)
        }

        if "total_sessions" not in existing_columns:
            schema_editor.execute(
                "ALTER TABLE focusapp_session ADD COLUMN total_sessions integer NOT NULL DEFAULT 1"
            )

        if "current_session" not in existing_columns:
            schema_editor.execute(
                "ALTER TABLE focusapp_session ADD COLUMN current_session integer NOT NULL DEFAULT 1"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("focusapp", "0003_session_status_otpverification"),
    ]

    operations = [
        migrations.RunPython(add_missing_session_columns, migrations.RunPython.noop),
    ]
