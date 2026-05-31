#!/usr/bin/env python3
"""Merge all individual topic files + group structure into a single topics-db.json"""

import json
import os
import copy

DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'topics-db')
OUTPUT = os.path.join(DB_DIR, 'topics-db.json')

# Mapping from categories.ts
TESTAMENTS = {
    'old-testament': {
        'title': 'Старий Завіт',
        'icon': '📜',
        'desc': 'Перша частина Біблії, яка описує створення світу та історію ізраїльського народу.',
        'themeIds': [
            'pentateuch', 'patriarchs', 'judges', 'kings',
            'wisdom-poetry', 'prophets', 'mosaic-law', 'commandments', 'geography',
        ],
        'all_id': 'ot-all',
    },
    'new-testament': {
        'title': 'Новий Завіт',
        'icon': '✝️',
        'desc': 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
        'themeIds': [
            'gospels', 'acts', 'paul', 'general-epistles',
            'revelation', 'geography-nt', 'parables', 'miracles',
        ],
        'all_id': 'nt-all',
    },
}

def add_theme_id(node, theme_id):
    """Recursively add themeId to every node in the tree"""
    node['themeId'] = theme_id
    for child in node.get('children', []):
        add_theme_id(child, theme_id)

def load_individual(theme_id):
    """Load an individual theme file and add themeId to all nodes"""
    path = os.path.join(DB_DIR, f'{theme_id}.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        node = json.load(f)
    add_theme_id(node, theme_id)
    return node

def load_extension_branches(covenant_id):
    """Custom branches from data/topics-db/extensions/{covenant}.json"""
    path = os.path.join(DB_DIR, 'extensions', f'{covenant_id}.json')
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        return data.get('branches', []) or []
    except (json.JSONDecodeError, OSError):
        print(f'WARN: failed to read extensions/{covenant_id}.json')
        return []

def main():
    root = {
        'id': 'bible-topics',
        'title': 'Біблія',
        'description': 'Повна ієрархія біблійних тем',
        'icon': '📖',
        'children': [],
    }

    for test_id, test_info in TESTAMENTS.items():
        # Aggregate "all" node
        all_children = []
        all_node = {
            'id': test_info['all_id'],
            'title': 'Усі питання з цієї теми',
            'description': f'Всі питання з {test_info["title"].lower()}',
            'icon': '📚',
            'themeId': test_id,
            'aggregateThemeIds': [test_id] + test_info['themeIds'],
            'children': [],
        }

        theme_nodes = []
        for theme_id in test_info['themeIds']:
            node = load_individual(theme_id)
            if node:
                theme_nodes.append(node)
            else:
                print(f'WARN: {theme_id}.json not found')

        # Build aggregate children: all questions from all themes
        for tn in theme_nodes:
            # Add a reference to the "all questions of this theme" node if it exists
            all_theme_node = {
                'id': f'{tn["id"]}-all',
                'title': f'Усі питання: {tn["title"]}',
                'description': f'Всі питання про {tn["title"].lower()}',
                'icon': tn.get('icon', '📖'),
                'themeId': tn['themeId'],
                'aggregateThemeIds': [tn['themeId']],
                'children': [],
            }
            all_children.append(all_theme_node)

        all_node['children'] = all_children

        # Build testament node
        extension_branches = load_extension_branches(test_id)
        for branch in extension_branches:
            add_theme_id(branch, test_id)

        test_node = {
            'id': test_id,
            'title': test_info['title'],
            'description': test_info['desc'],
            'icon': test_info['icon'],
            'children': [all_node] + theme_nodes + extension_branches,
        }

        root['children'].append(test_node)

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(root, f, ensure_ascii=False, indent=2)

    # Count total nodes
    def count_nodes(n):
        return 1 + sum(count_nodes(c) for c in n.get('children', []))

    total = count_nodes(root)
    print(f'Generated {OUTPUT}')
    print(f'Total nodes: {total}')
    print(f'Root children: {len(root["children"])} (testaments)')
    for test in root['children']:
        print(f'  {test["id"]}: {len(test["children"])} children ({sum(count_nodes(c) for c in test["children"])} total nodes)')

if __name__ == '__main__':
    main()
