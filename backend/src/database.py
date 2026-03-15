import sqlite3
import os
from types_defs import SituationAnalysisResult, ObjectRelationship

DATABASE_NAME = os.getenv("DATABASE_NAME", "test.db")
conn = sqlite3.connect(DATABASE_NAME)

def init_db():
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS object_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            object_a TEXT NOT NULL,
            object_b TEXT NOT NULL,
            unsafe_distance INTEGER NOT NULL DEFAULT 0,
            user_defined BOOLEAN NOT NULL DEFAULT 0,
            UNIQUE(object_a, object_b)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS special_instructions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instruction TEXT
        )
    ''')
    conn.commit()

def insert_object_relationship(relationship: ObjectRelationship, user_defined: bool = True):
    """Insert or replace a relationship. user_defined=True (default) allows overwriting any row."""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO object_relationships (object_a, object_b, unsafe_distance, user_defined)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(object_a, object_b) DO UPDATE SET
            unsafe_distance = excluded.unsafe_distance,
            user_defined = excluded.user_defined
    ''', (relationship.object_a, relationship.object_b, relationship.unsafe_distance, user_defined))
    conn.commit()

def insert_ai_object_relationship(relationship: ObjectRelationship):
    """Insert an AI-suggested relationship only if no user-defined entry already exists for this pair."""
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO object_relationships (object_a, object_b, unsafe_distance, user_defined)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(object_a, object_b) DO UPDATE SET
            unsafe_distance = excluded.unsafe_distance,
            user_defined = 0
        WHERE user_defined = 0
    ''', (relationship.object_a, relationship.object_b, relationship.unsafe_distance))
    conn.commit()

def get_all_relationships() -> list[ObjectRelationship]:
    cursor = conn.cursor()
    cursor.execute('SELECT object_a, object_b, unsafe_distance FROM object_relationships')
    rows = cursor.fetchall()
    return [ObjectRelationship(object_a=row[0], object_b=row[1], unsafe_distance=row[2]) for row in rows]

def insert_special_instruction(instruction: str):
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO special_instructions (instruction)
        VALUES (?)
    ''', (instruction,))
    conn.commit()

def get_all_special_instructions() -> list[str]:
    cursor = conn.cursor()
    cursor.execute('SELECT instruction FROM special_instructions')
    rows = cursor.fetchall()
    return [row[0] for row in rows]