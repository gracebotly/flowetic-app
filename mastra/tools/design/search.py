#!/usr/bin/env python3
"""
BM25-based search over UI/UX Pro Max design databases.
Supports keyword search across 7 domains (products, styles, colors, typography, landing, chart, ux).
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass
from rank_bm25 import BM25Okapi

@dataclass
class SearchResult:
    """Single search result with score"""
    domain: str
    content: str
    metadata: Dict[str, Any]
    score: float

class DesignSearchEngine:
    """BM25 search engine for design databases"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.domains = {
            'product': 'products.csv',
            'style': 'styles.csv',
            'color': 'colors.csv',
            'typography': 'typography.csv',
            'landing': 'landing-pages.csv',
            'chart': 'charts.csv',
            'ux': 'ux-guidelines.csv',
        }
        self.indices = {}
        self.documents = {}
        
    def load_domain(self, domain: str) -> List[Dict[str, Any]]:
        """Load CSV data for a domain"""
        csv_path = self.data_dir / self.domains.get(domain, f"{domain}.csv")
        
        if not csv_path.exists():
            return []
        
        documents = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                documents.append(row)
        
        return documents
    
    def build_index(self, domain: str):
        """Build BM25 index for a domain"""
        docs = self.load_domain(domain)
        if not docs:
            return
        
        # Tokenize all text fields
        tokenized_corpus = []
        for doc in docs:
            # Combine all text fields for searchability
            text = " ".join([str(v) for v in doc.values() if v])
            tokens = text.lower().split()
            tokenized_corpus.append(tokens)
        
        self.indices[domain] = BM25Okapi(tokenized_corpus)
        self.documents[domain] = docs
    
    def search(self, query: str, domain: str = None, max_results: int = 10) -> List[SearchResult]:
        """Search across one or all domains"""
        query_tokens = query.lower().split()
        results = []
        
        # Determine which domains to search
        domains_to_search = [domain] if domain else self.domains.keys()
        
        for d in domains_to_search:
            if d not in self.indices:
                self.build_index(d)
            
            if d not in self.indices or not self.documents[d]:
                continue
            
            scores = self.indices[d].get_scores(query_tokens)
            
            for idx, score in enumerate(scores):
                if score > 0:  # Only include results with positive scores
                    results.append(SearchResult(
                        domain=d,
                        content=json.dumps(self.documents[d][idx]),
                        metadata=self.documents[d][idx],
                        score=score
                    ))
        
        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:max_results]
    
    def design_system_generator(self, query: str, project_name: str) -> Dict[str, Any]:
        """Generate complete design system from query"""
        # Search across all key domains
        product_results = self.search(query, domain='product', max_results=3)
        style_results = self.search(query, domain='style', max_results=3)
        color_results = self.search(query, domain='color', max_results=3)
        typography_results = self.search(query, domain='typography', max_results=3)
        landing_results = self.search(query, domain='landing', max_results=3)
        chart_results = self.search(query, domain='chart', max_results=5)
        ux_results = self.search(query, domain='ux', max_results=5)
        
        # Format output with complete recommendations
        output = {
            "project_name": project_name,
            "query": query,
            "recommendations": {
                "product": product_results[0].metadata if product_results else {},
                "style": style_results[0].metadata if style_results else {},
                "color_palette": color_results[0].metadata if color_results else {},
                "typography": typography_results[0].metadata if typography_results else {},
                "landing_pattern": landing_results[0].metadata if landing_results else {},
                "charts": [r.metadata for r in chart_results[:3]],
                "ux_guidelines": [r.metadata for r in ux_results[:5]],
            },
            "alternatives": {
                "products": [r.metadata for r in product_results[1:3]],
                "styles": [r.metadata for r in style_results[1:3]],
                "colors": [r.metadata for r in color_results[1:3]],
                "typography": [r.metadata for r in typography_results[1:3]],
                "landing_patterns": [r.metadata for r in landing_results[1:3]],
            },
            "anti_patterns": self._extract_anti_patterns(product_results, style_results),
            "checklist": self._generate_checklist(ux_results),
        }
        
        return output
    
    def _extract_anti_patterns(self, product_results: List[SearchResult], style_results: List[SearchResult]) -> List[str]:
        """Extract anti-patterns from product and style recommendations"""
        anti_patterns = []
        
        for result in product_results[:2]:
            if 'anti_patterns' in result.metadata:
                patterns = result.metadata['anti_patterns'].split(';')
                anti_patterns.extend(patterns)
        
        return list(set(anti_patterns))[:5]  # Top 5 unique anti-patterns

    def _generate_checklist(self, ux_results: List[SearchResult]) -> List[Dict[str, str]]:
        """Generate pre-delivery checklist from UX guidelines"""
        checklist = []
        
        for result in ux_results[:10]:
            if result.metadata.get('guideline_name') and result.metadata.get('rule'):
                checklist.append({
                    "item": result.metadata['guideline_name'],
                    "rule": result.metadata['rule'],
                    "category": result.metadata.get('category', 'general'),
                })
        
        return checklist

def main():
    parser = argparse.ArgumentParser(description='Search UI/UX Pro Max design databases')
    parser.add_argument('query', help='Search query')
    parser.add_argument('--domain', choices=['product', 'style', 'color', 'typography', 'landing', 'chart', 'ux'], 
                       help='Specific domain to search')
    parser.add_argument('--design-system', action='store_true',
                       help='Generate complete design system')
    parser.add_argument('-p', '--project', help='Project name (for design system)')
    parser.add_argument('--max-results', type=int, default=10, help='Maximum results')
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).parent.parent.parent / 'data' / 'ui-ux-pro-max',
                       help='Path to CSV data directory')
    
    args = parser.parse_args()
    
    # Initialize search engine
    engine = DesignSearchEngine(args.data_dir)
    
    if args.design_system:
        # Generate complete design system
        result = engine.design_system_generator(args.query, args.project or "Project")
        print(json.dumps(result, indent=2))
    else:
        # Regular search
        results = engine.search(args.query, domain=args.domain, max_results=args.max_results)
        
        # Format output
        output = {
            "query": args.query,
            "domain": args.domain or "all",
            "results": [
                {
                    "domain": r.domain,
                    "score": r.score,
                    "content": r.metadata
                }
                for r in results
            ]
        }
        
        print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
