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
            'pentateuch',
            'judges', 'kings', 'prophets', 'wisdom-poetry', 'geography',
        ],
        # Embedded themes: question pools keep themeId, not top-level browse branches
        'aggregateExtraThemeIds': ['patriarchs', 'commandments'],
        'all_id': 'ot-all',
    },
    'new-testament': {
        'title': 'Новий Завіт',
        'icon': '✝️',
        'desc': 'Друга частина Біблії, яка описує життя Ісуса Христа та народження християнської церкви.',
        'themeIds': [
            'gospels', 'parables', 'miracles', 'acts', 'paul',
            'general-epistles', 'revelation', 'geography-nt',
        ],
        'all_id': 'nt-all',
    },
}

# Themes embedded inside another theme file (not top-level siblings)
EMBEDDED_IN = {
    'patriarchs': {
        'parent_theme': 'pentateuch',
        'parent_node_id': 'pentateuch-sub-1',
        'wrapper_id': 'patriarchs',
    },
    'commandments': {
        'parent_theme': 'pentateuch',
        'parent_node_id': 'pentateuch-sub-2-group-4',
        'wrapper_id': 'commandments',
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


def find_node_by_id(node, target_id):
    if node.get('id') == target_id:
        return node
    for child in node.get('children', []):
        found = find_node_by_id(child, target_id)
        if found:
            return found
    return None


def embed_theme_in_parent(parent_node, source_node, parent_node_id, wrapper_id):
    """Nest a theme under a parent node; keep wrapper id for question tags and deep links."""
    anchor = find_node_by_id(parent_node, parent_node_id)
    if not anchor:
        print(f'WARN: {parent_node_id} not found — {wrapper_id} not embedded')
        return

    wrapper = {
        'id': wrapper_id,
        'title': source_node['title'],
        'description': source_node['description'],
        'icon': source_node.get('icon', '📖'),
        'themeId': wrapper_id,
        'children': copy.deepcopy(source_node.get('children', [])),
    }
    add_theme_id(wrapper, wrapper_id)
    anchor.setdefault('children', []).append(wrapper)


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

    embedded_theme_ids = set(EMBEDDED_IN.keys())
    embedded_sources = {
        theme_id: load_individual(theme_id) for theme_id in embedded_theme_ids
    }

    for test_id, test_info in TESTAMENTS.items():
        # Aggregate "*-all" wrappers більше не генеруємо.

        theme_nodes = []
        for theme_id in test_info['themeIds']:
            if theme_id in embedded_theme_ids:
                continue
            node = load_individual(theme_id)
            if node:
                for embedded_id, cfg in EMBEDDED_IN.items():
                    if cfg['parent_theme'] != theme_id:
                        continue
                    source = embedded_sources.get(embedded_id)
                    if source:
                        embed_theme_in_parent(
                            node,
                            source,
                            cfg['parent_node_id'],
                            cfg['wrapper_id'],
                        )
                theme_nodes.append(node)
            else:
                print(f'WARN: {theme_id}.json not found')

        extension_branches = load_extension_branches(test_id)
        for branch in extension_branches:
            add_theme_id(branch, test_id)

        test_node = {
            'id': test_id,
            'title': test_info['title'],
            'description': test_info['desc'],
            'icon': test_info['icon'],
            'children': theme_nodes + extension_branches,
        }

        root['children'].append(test_node)

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(root, f, ensure_ascii=False, indent=2)

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
