"""GATE DA (Data Science & AI) syllabus, broken into trackable topics with planning metadata.

Each topic carries:
  importance  1-5  (rough GATE DA weightage/frequency; 5 = appears almost every year, heavily weighted)
  difficulty  Easy | Medium | Hard
  hours       realistic self-study hours for a first pass (learn + practice), used for day-wise planning
  subtopics   basic -> advanced breakdown studied in order

Topic IDs are generated from position (e.g. LA-01). Append new topics at the END of a subject
so existing progress stays attached to the right topic.
"""

DIFF_BASE_HOURS = {"Easy": 2.5, "Medium": 4.5, "Hard": 7.0}


def _topic(name, scope, importance, difficulty, subtopics, hours=None, section="", rank=None):
    return {
        "name": name, "scope": scope, "importance": importance, "difficulty": difficulty,
        "subtopics": subtopics, "section": section, "rank": rank,
        "hours": hours if hours is not None else round(DIFF_BASE_HOURS[difficulty] * (0.8 + 0.1 * importance), 1),
    }


_RAW = [
    ("LA", "Linear Algebra", [
        _topic("Vector spaces & subspaces", "Vector space, subspace, span, basis, dimension", 3, "Medium",
               ["Vectors & vector spaces", "Subspace & span", "Basis & dimension"]),
        _topic("Linear dependence & independence", "Linear dependence and independence of vectors, basis", 3, "Easy",
               ["Dependence/independence test", "Relation to basis & rank"]),
        _topic("Matrices & special matrices", "Matrix operations, projection, orthogonal, idempotent, partitioned matrices", 4, "Medium",
               ["Matrix algebra basics", "Symmetric/orthogonal/idempotent matrices", "Partitioned matrices"]),
        _topic("Determinant, rank & nullity", "Determinant, rank, nullity, rank-nullity theorem", 4, "Medium",
               ["Determinant properties", "Rank via row reduction", "Rank-nullity theorem"]),
        _topic("Systems of linear equations", "Solutions of linear systems, consistency, Gaussian elimination", 4, "Medium",
               ["Gaussian elimination", "Consistency conditions", "Solution space (unique/infinite/none)"]),
        _topic("Eigenvalues & eigenvectors", "Characteristic polynomial, eigenvalue properties, diagonalization", 5, "Hard",
               ["Characteristic equation", "Eigenvectors & eigenspaces", "Diagonalization"]),
        _topic("Quadratic forms", "Quadratic forms, definiteness of matrices", 2, "Medium",
               ["Quadratic form from a matrix", "Positive/negative definiteness"]),
        _topic("Projections & orthogonality", "Projection onto subspaces, orthogonal projection, link to least squares", 3, "Hard",
               ["Orthogonal vectors/basis", "Projection matrices", "Link to least-squares regression"]),
        _topic("LU decomposition", "LU decomposition and its use in solving systems", 2, "Medium",
               ["LU factorization steps", "Solving Ax=b via LU"]),
        _topic("Singular value decomposition", "SVD, singular values, relation with eigen decomposition", 4, "Hard",
               ["SVD definition & computation", "Relation to eigendecomposition", "Use in PCA/dimensionality reduction"]),
    ]),
    ("PS", "Probability & Statistics", [
        _topic("Counting: permutations & combinations", "Counting principles, permutations, combinations", 2, "Easy",
               ["Permutations", "Combinations", "Basic counting problems"]),
        _topic("Probability axioms, sample space & events", "Axioms of probability, sample space, events", 3, "Easy",
               ["Sample space & events", "Axioms of probability"]),
        _topic("Independent & mutually exclusive events", "Independence vs mutual exclusivity", 3, "Easy",
               ["Independence", "Mutual exclusivity", "Common confusion traps"]),
        _topic("Marginal, conditional & joint probability", "Joint, marginal and conditional probability", 4, "Medium",
               ["Joint distributions", "Marginalization", "Conditional probability"]),
        _topic("Bayes' theorem", "Bayes theorem, total probability, posterior/prior", 5, "Medium",
               ["Law of total probability", "Bayes theorem derivation", "Applied Bayes problems"]),
        _topic("Random variables: PMF, PDF, CDF", "Discrete random variables and PMF, PDF and CDF of continuous variables", 5, "Medium",
               ["Discrete RVs & PMF", "Continuous RVs & PDF", "CDF and its properties"]),
        _topic("Expectation & variance", "Expectation, variance, conditional expectation and conditional variance", 5, "Medium",
               ["E[X] and Var(X)", "Linearity of expectation", "Conditional expectation/variance"]),
        _topic("Descriptive stats, correlation & covariance", "Mean, median, mode, standard deviation, correlation, covariance", 4, "Easy",
               ["Central tendency & spread", "Covariance", "Correlation coefficient"]),
        _topic("Discrete distributions", "Uniform, Bernoulli, binomial, Poisson", 4, "Medium",
               ["Bernoulli & Binomial", "Poisson", "Discrete uniform"]),
        _topic("Continuous distributions", "Uniform, exponential, normal, standard normal", 5, "Medium",
               ["Uniform & exponential", "Normal distribution", "Standardization (z-scores)"]),
        _topic("t and chi-squared distributions", "t-distribution, chi-squared distribution, degrees of freedom", 3, "Medium",
               ["t-distribution & when it's used", "Chi-squared distribution", "Degrees of freedom"]),
        _topic("Central limit theorem", "CLT and sampling distribution of the mean", 4, "Medium",
               ["Sampling distribution", "CLT statement", "Practical implications"]),
        _topic("Confidence intervals", "Confidence intervals for mean (z and t)", 3, "Medium",
               ["CI with known variance (z)", "CI with unknown variance (t)", "Interpreting confidence level"]),
        _topic("Hypothesis testing", "z-test, t-test, chi-squared test, p-values, errors", 4, "Hard",
               ["Null/alternative hypothesis", "z-test & t-test", "p-values, Type I/II errors"]),
    ]),
    ("CO", "Calculus & Optimization", [
        _topic("Limits & functions of one variable", "Functions of a single variable, limits", 2, "Easy",
               ["Functions & domains", "Limits"]),
        _topic("Continuity & differentiability", "Continuity, differentiability", 2, "Easy",
               ["Continuity conditions", "Differentiability"]),
        _topic("Taylor series", "Taylor series expansion and approximation", 2, "Medium",
               ["Taylor expansion", "Linear/quadratic approximation"]),
        _topic("Maxima & minima", "Local/global maxima and minima, first and second derivative tests", 4, "Medium",
               ["First derivative test", "Second derivative test", "Global vs local extrema"]),
        _topic("Single-variable optimization", "Optimization problems involving a single variable", 4, "Medium",
               ["Setting up objective functions", "Constrained vs unconstrained", "Applied optimization problems"]),
    ]),
    ("PD", "Programming & DSA", [
        _topic("Python: output tracing & GATE-style problems", "Tracing Python code output, GATE-style programming questions", 5, "Medium",
               ["Tracing loops & functions", "Tracing list/dict/set code", "Typical GATE DA Python questions"], section="Python", rank=90),
        _topic("Stacks & queues", "Stack, queue, applications, implementations", 3, "Easy",
               ["Stack operations & uses", "Queue operations & uses"], section="DSA"),
        _topic("Linked lists", "Singly/doubly linked lists, operations", 3, "Medium",
               ["Singly linked list ops", "Doubly linked list ops"], section="DSA"),
        _topic("Trees", "Binary trees, BST, traversals, height", 4, "Medium",
               ["Binary tree basics", "BST properties & operations", "Traversals (in/pre/post/level)"], section="DSA"),
        _topic("Hash tables", "Hashing, collision resolution", 3, "Medium",
               ["Hash functions", "Collision resolution (chaining/open addressing)"], section="DSA"),
        _topic("Linear & binary search + complexity", "Linear search, binary search, time complexity analysis", 4, "Easy",
               ["Linear search", "Binary search", "Big-O analysis basics"], section="DSA"),
        _topic("Elementary sorting", "Selection sort, bubble sort, insertion sort", 3, "Easy",
               ["Selection sort", "Bubble sort", "Insertion sort"], section="DSA"),
        _topic("Merge sort & quicksort", "Mergesort, quicksort, complexity, recurrences", 5, "Hard",
               ["Mergesort & its recurrence", "Quicksort & pivoting", "Best/worst/average case"], section="DSA"),
        _topic("Divide and conquer", "Divide-and-conquer paradigm, recurrence solving", 4, "Hard",
               ["D&C paradigm", "Recurrence relations", "Master theorem (intuitive use)"], section="DSA"),
        _topic("Graph theory basics", "Graph terminology, representations", 3, "Easy",
               ["Graph terminology", "Adjacency list vs matrix"], section="DSA"),
        _topic("Graph traversals", "BFS, DFS", 4, "Medium",
               ["BFS", "DFS", "Applications (connectivity, cycles)"], section="DSA"),
        _topic("Shortest path algorithms", "Basic shortest path (e.g., Dijkstra, BFS on unweighted)", 3, "Medium",
               ["BFS shortest path (unweighted)", "Dijkstra's algorithm"], section="DSA"),

        # ---- Python course (new topics are appended so old progress IDs stay valid) ----
        _topic("Python basics: variables, types, I/O & operators", "Variables, data types, input/output, arithmetic/comparison/logical operators", 5, "Easy",
               ["Variables & naming", "Data types (int, float, str, bool)", "Input & output (print/input, f-strings)", "Operators & precedence"], section="Python", rank=10),
        _topic("Conditionals & statements", "if/elif/else, nested conditions, boolean logic, match", 5, "Easy",
               ["if / elif / else", "Nested conditions", "Boolean logic & short-circuiting"], section="Python", rank=20),
        _topic("Loops", "for and while loops, range, break/continue, nested loops", 5, "Easy",
               ["for loop & range()", "while loop", "break, continue, else on loops", "Nested loops & patterns"], section="Python", rank=30),
        _topic("Functions & recursion", "Defining functions, arguments, return values, scope, recursion, lambda", 5, "Medium",
               ["Defining & calling functions", "Arguments (default, keyword, *args/**kwargs)", "Scope (local/global)", "Recursion", "Lambda functions"], section="Python", rank=40),
        _topic("Strings", "String methods, slicing, formatting, immutability", 4, "Easy",
               ["Indexing & slicing", "Common string methods", "String formatting"], section="Python", rank=50),
        _topic("Lists, tuples, sets & dictionaries", "Built-in collections, methods, mutability, copying", 5, "Easy",
               ["Lists & list methods", "Tuples & immutability", "Sets & set operations", "Dictionaries", "Shallow vs deep copy"], section="Python", rank=60),
        _topic("Comprehensions, iterators & generators", "List/dict/set comprehensions, iterators, generators, enumerate/zip/map/filter", 4, "Medium",
               ["List/dict/set comprehensions", "enumerate, zip, map, filter", "Iterators & generators"], section="Python", rank=70),
        _topic("OOP, exceptions & files", "Classes, objects, inheritance, try/except, reading/writing files", 3, "Medium",
               ["Classes & objects", "Inheritance & methods", "Exceptions (try/except)", "File handling"], section="Python", rank=80),
        # ---- DSA course ----
        _topic("Arrays & complexity basics", "Arrays, indexing, 2-D arrays, time/space complexity, Big-O", 4, "Easy",
               ["Arrays & indexing", "2-D arrays", "Time & space complexity", "Big-O, Omega, Theta"], section="DSA", rank=101),
    ]),
    ("DB", "DBMS & Warehousing", [
        _topic("ER model", "Entities, relationships, cardinality, ER to relational", 3, "Easy",
               ["Entities & relationships", "Cardinality constraints", "ER to relational mapping"]),
        _topic("Relational model & relational algebra", "Relational model, relational algebra operators", 4, "Medium",
               ["Relational model basics", "Selection/projection/join", "Set operators"]),
        _topic("Tuple calculus", "Tuple relational calculus", 2, "Medium",
               ["Tuple calculus notation", "Converting algebra <-> calculus"]),
        _topic("SQL", "SQL queries, joins, aggregation, subqueries, group by", 5, "Medium",
               ["SELECT/WHERE/JOIN", "GROUP BY & aggregation", "Subqueries & nested queries"]),
        _topic("Integrity constraints", "Keys, foreign keys, domain and referential integrity", 3, "Easy",
               ["Keys (primary/candidate/foreign)", "Referential integrity"]),
        _topic("Normal forms", "Functional dependencies, 1NF-BCNF", 4, "Hard",
               ["Functional dependencies", "1NF/2NF/3NF", "BCNF"]),
        _topic("File organization & indexing", "File organization, indexing", 2, "Medium",
               ["File organization basics", "Indexing (B-tree intuition)"]),
        _topic("Data types & data transformation", "Normalization, discretization, sampling, compression", 3, "Easy",
               ["Normalization/scaling", "Discretization & binning", "Sampling methods"]),
        _topic("Data warehouse modelling", "Star/snowflake schema, multidimensional model, concept hierarchies, measures", 3, "Medium",
               ["Star vs snowflake schema", "Fact & dimension tables", "Concept hierarchies & measures"]),
    ]),
    ("ML", "Machine Learning", [
        _topic("Linear regression (simple & multiple)", "Regression vs classification, simple and multiple linear regression", 5, "Medium",
               ["Simple linear regression", "Multiple linear regression", "Assumptions & cost function"]),
        _topic("Ridge regression", "Regularization, ridge regression", 4, "Medium",
               ["L2 regularization", "Bias-variance effect of ridge"]),
        _topic("Logistic regression", "Logistic regression for classification", 5, "Medium",
               ["Sigmoid & decision boundary", "Log-loss / cross-entropy", "Multi-class extension"]),
        _topic("k-nearest neighbours", "kNN classifier", 4, "Easy",
               ["Distance metrics", "Choosing k", "Pros/cons of kNN"]),
        _topic("Naive Bayes classifier", "Naive Bayes", 4, "Medium",
               ["Bayes rule for classification", "Independence assumption", "Variants (Gaussian/Multinomial)"]),
        _topic("Linear discriminant analysis", "LDA classifier", 3, "Hard",
               ["LDA assumptions", "Decision boundary derivation"]),
        _topic("Support vector machines", "SVM, margin, kernels", 5, "Hard",
               ["Margin maximization", "Soft margin & C", "Kernel trick"]),
        _topic("Decision trees", "Decision trees, impurity measures", 4, "Medium",
               ["Gini/entropy impurity", "Tree construction", "Pruning"]),
        _topic("Bias-variance trade-off", "Bias, variance, over/underfitting", 5, "Medium",
               ["Bias vs variance", "Overfitting/underfitting", "Model complexity trade-off"]),
        _topic("Cross-validation", "Leave-one-out, k-fold cross-validation", 4, "Easy",
               ["k-fold CV", "Leave-one-out CV"]),
        _topic("MLP & feed-forward neural networks", "Multi-layer perceptron, feed-forward networks, backpropagation basics", 5, "Hard",
               ["Perceptron & activation functions", "Forward pass", "Backpropagation intuition"]),
        _topic("Clustering: k-means / k-medoid", "k-means, k-medoid", 4, "Medium",
               ["k-means algorithm", "k-medoid", "Choosing k / initialization"]),
        _topic("Hierarchical clustering", "Top-down, bottom-up, single and multiple linkage", 3, "Medium",
               ["Agglomerative vs divisive", "Linkage criteria", "Dendrograms"]),
        _topic("Principal component analysis", "PCA, dimensionality reduction", 5, "Hard",
               ["Variance maximization view", "Eigen-decomposition/SVD link", "Choosing number of components"]),
    ]),
    ("AI", "Artificial Intelligence", [
        _topic("Uninformed search", "BFS, DFS, uniform-cost, depth-limited, iterative deepening", 3, "Medium",
               ["BFS/DFS for search", "Uniform-cost search", "Iterative deepening"]),
        _topic("Informed search", "Greedy best-first, A*, heuristics", 4, "Medium",
               ["Heuristic functions", "Greedy best-first", "A* search"]),
        _topic("Adversarial search", "Minimax, alpha-beta pruning", 3, "Medium",
               ["Minimax algorithm", "Alpha-beta pruning"]),
        _topic("Propositional logic", "Propositional logic, inference, resolution", 3, "Medium",
               ["Syntax & semantics", "Inference rules", "Resolution"]),
        _topic("Predicate logic", "First-order logic", 3, "Medium",
               ["FOL syntax", "Quantifiers", "Translating statements to FOL"]),
        _topic("Conditional independence & Bayesian networks", "Conditional independence representation", 4, "Hard",
               ["Bayesian network structure", "Conditional independence (d-separation intuition)"]),
        _topic("Exact inference: variable elimination", "Variable elimination in Bayesian networks", 3, "Hard",
               ["Factors & elimination order", "Variable elimination algorithm"]),
        _topic("Approximate inference: sampling", "Sampling-based approximate inference", 2, "Hard",
               ["Rejection sampling", "Basic Monte Carlo idea"]),
    ]),
    ("GA", "General Aptitude", [
        _topic("Verbal ability", "Grammar, vocabulary, reading comprehension, sentence completion", 3, "Easy",
               ["Grammar & vocabulary", "Reading comprehension", "Sentence completion"]),
        _topic("Quantitative aptitude", "Numerical computation, ratios, percentages, time-work, speed-distance, data interpretation", 4, "Medium",
               ["Ratios/percentages", "Time-work & speed-distance", "Data interpretation"]),
        _topic("Analytical reasoning", "Logical reasoning, series, puzzles, seating arrangements", 3, "Medium",
               ["Series & patterns", "Puzzles & seating arrangements"]),
        _topic("Spatial aptitude", "Paper folding, cubes, patterns, mirror images", 2, "Easy",
               ["Paper folding & cubes", "Mirror/pattern images"]),
    ]),
]

SUBJECT_ORDER = [s[1] for s in _RAW]
SUBJECT_CODE = {s[1]: s[0] for s in _RAW}

ALL_TOPICS = []
for code, subject, topics in _RAW:
    for i, tdef in enumerate(topics, 1):
        t = {"id": f"{code}-{i:02d}", "subject": subject, "order": i}
        t.update(tdef)
        if t.get("rank") is None:
            t["rank"] = 100 + i  # keeps original syllabus order (basic -> advanced) unless overridden
        if not t.get("section"):
            t["section"] = ""
        ALL_TOPICS.append(t)

TOPIC_BY_ID = {t["id"]: t for t in ALL_TOPICS}

# Names only (no URLs) so nothing goes stale or wrong. Topic pages also generate live search links.
SUBJECT_RESOURCES = {
    "Linear Algebra": ["Gilbert Strang - MIT 18.06 (OCW)", "3Blue1Brown - Essence of Linear Algebra", "NPTEL Linear Algebra"],
    "Probability & Statistics": ["Harvard Stat 110 (Joe Blitzstein)", "StatQuest (YouTube)", "NPTEL Probability & Statistics"],
    "Calculus & Optimization": ["3Blue1Brown - Essence of Calculus", "Khan Academy Calculus"],
    "Programming & DSA": ["Abdul Bari - Algorithms (YouTube)", "NPTEL Data Structures", "Python official tutorial"],
    "DBMS & Warehousing": ["NPTEL DBMS (S. Sudarshan)", "Database System Concepts (Silberschatz)", "Gate Smashers DBMS"],
    "Machine Learning": ["Andrew Ng - ML Specialization", "NPTEL Intro to Machine Learning (IIT Madras)", "StatQuest"],
    "Artificial Intelligence": ["NPTEL AI: Search Methods for Problem Solving", "AIMA - Russell & Norvig"],
    "General Aptitude": ["GATE previous-year GA papers", "GATE Overflow"],
}

# Well-known reference books per subject (names only - searchable, nothing to go stale).
SUBJECT_BOOKS = {
    "Linear Algebra": ["Gilbert Strang - Introduction to Linear Algebra", "David C. Lay - Linear Algebra and Its Applications"],
    "Probability & Statistics": ["Sheldon Ross - A First Course in Probability", "DeGroot & Schervish - Probability and Statistics"],
    "Calculus & Optimization": ["Thomas' Calculus", "Boyd & Vandenberghe - Convex Optimization (reference chapters)"],
    "Programming & DSA": ["Cormen et al. - Introduction to Algorithms (CLRS)", "Narasimha Karumanchi - Data Structures and Algorithms Made Easy"],
    "DBMS & Warehousing": ["Silberschatz, Korth, Sudarshan - Database System Concepts", "Ramakrishnan & Gehrke - Database Management Systems"],
    "Machine Learning": ["Hastie, Tibshirani, Friedman - The Elements of Statistical Learning", "Christopher Bishop - Pattern Recognition and Machine Learning", "Andrew Ng's CS229 notes"],
    "Artificial Intelligence": ["Russell & Norvig - Artificial Intelligence: A Modern Approach"],
    "General Aptitude": ["RS Aggarwal - Quantitative Aptitude", "GATE previous-year GA compilations"],
}

# Section-level overrides (e.g. the Python part of "Programming & DSA" needs Python resources, not DSA ones).
# Key = "<subject>/<section>". Names only, so nothing goes stale.
SECTION_RESOURCES = {
    "Programming & DSA/Python": ["CS50's Introduction to Programming with Python (Harvard)", "Corey Schafer - Python tutorials (YouTube)",
                                 "Python official tutorial (docs.python.org)", "freeCodeCamp - Python for Everybody"],
}
SECTION_BOOKS = {
    "Programming & DSA/Python": ["Eric Matthes - Python Crash Course", "Al Sweigart - Automate the Boring Stuff with Python",
                                 "Allen Downey - Think Python"],
}
