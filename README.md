# 📘 xcraft-core-fs

## Aperçu

Le module `xcraft-core-fs` est une bibliothèque d'utilitaires pour les opérations sur le système de fichiers dans l'écosystème Xcraft. Il fournit une couche d'abstraction au-dessus de `fs-extra` avec des fonctionnalités étendues pour la manipulation de fichiers et dossiers, incluant des opérations de copie, déplacement, suppression, listage et calcul de sommes de contrôle.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module expose une collection de fonctions utilitaires organisées autour des opérations courantes du système de fichiers :

- **Opérations de base** : `cp`, `mv`, `rm`, `mkdir`
- **Opérations de listage** : `ls`, `lsdir`, `lsfile`, `lsall`
- **Opérations spécialisées** : `batch`, `shasum`, `sed`, `newerFiles`
- **Utilitaires** : `canExecute`, `rmSymlinks`, `rmFiles`

## Fonctionnement global

Le module étend les capacités de `fs-extra` en ajoutant des fonctionnalités spécifiques aux besoins de Xcraft :

1. **Gestion robuste des erreurs** : Toutes les opérations incluent une gestion d'erreurs appropriée avec des codes d'erreur spécifiques (ENOENT, EPERM)
2. **Support des liens symboliques** : Traitement spécial pour les liens symboliques dans toutes les opérations avec préservation des liens
3. **Opérations récursives** : Support natif pour les opérations sur les arborescences de dossiers
4. **Filtrage par regex** : Possibilité de filtrer les fichiers/dossiers avec des expressions régulières ou des fonctions personnalisées
5. **Opérations par lot** : Système de traitement par lot avec callbacks personnalisés pour les transformations de noms
6. **Optimisation des performances** : Copie par chunks de 64KB et utilisation de `rename` avec fallback pour les déplacements

## Exemples d'utilisation

### Copie de fichiers et dossiers

```javascript
const xFs = require('xcraft-core-fs');

// Copier un fichier
xFs.cp('source/file.txt', 'dest/file.txt');

// Copier le contenu d'un dossier
xFs.cp('source/dir', 'dest/dir');

// Copier avec filtrage
xFs.cp('source', 'dest', /\.js$/); // Seulement les fichiers .js
```

### Déplacement avec gestion des erreurs

```javascript
// Déplacement sécurisé (fallback copy+rm si rename échoue)
xFs.mv('old/location', 'new/location');

// Déplacement avec filtrage
xFs.mv('source', 'dest', /\.(txt|md)$/);
```

### Listage avancé

```javascript
// Lister tous les fichiers récursivement
const allFiles = xFs.lsall('/path/to/dir');

// Lister avec filtre personnalisé
const jsFiles = xFs.lsall('/src', false, (item, stats) => {
  return item.endsWith('.js') && stats && stats.isFile();
});

// Lister seulement les dossiers
const dirs = xFs.lsdir('/path', /^[^.]/); // Exclure les dossiers cachés
```

### Calcul de somme de contrôle

```javascript
// Calculer le SHA256 d'une arborescence
const checksum = xFs.shasum('/project/src', /\.js$/);

// Avec transformation des données
const checksumWithSed = xFs.shasum('/src', /\.js$/, (file, data) => {
  return data.toString().replace(/console\.log/g, '// console.log');
});

// Avec filtre fonction
const checksum = xFs.shasum('/src', (item) => item.endsWith('.js'));
```

### Opérations par lot

```javascript
// Renommer tous les fichiers avec un callback
xFs.batch.mv((location, filename) => {
  if (filename.endsWith('.tmp')) {
    return filename.replace('.tmp', '.bak');
  }
  return null; // Ne pas traiter ce fichier
}, '/temp/dir');
```

### Utilitaires spécialisés

```javascript
// Vérifier les permissions d'exécution
if (xFs.canExecute('/usr/bin/node')) {
  console.log('Node.js est exécutable');
}

// Supprimer tous les liens symboliques
xFs.rmSymlinks('/project/node_modules');

// Modifier le contenu d'un fichier
const modified = xFs.sed('config.js', /debug:\s*true/, 'debug: false');
```

## Interactions avec d'autres modules

Le module `xcraft-core-fs` est une dépendance fondamentale utilisée par de nombreux modules de l'écosystème Xcraft :

- **Modules de build** : Utilisé pour la copie et manipulation de fichiers lors des processus de construction
- **Modules de configuration** : Utilisé pour la lecture et modification de fichiers de configuration
- **Modules de déploiement** : Utilisé pour les opérations de déploiement et synchronisation de fichiers
- **Modules de cache** : Utilisé pour la gestion des fichiers de cache et leur nettoyage

## Détails des sources

### `index.js`

Le fichier principal expose toutes les fonctionnalités du module organisées en plusieurs catégories :

#### Opérations de base

- **`mkdir(location)`** — Crée un dossier et tous ses parents nécessaires (équivalent à `mkdir -p`).

- **`cp(src, dest, regex)`** — Copie un fichier ou le contenu d'un dossier. Supporte le filtrage par regex et crée automatiquement les dossiers intermédiaires. Gère correctement les liens symboliques en préservant leur cible.

- **`mv(src, dest, regex = null)`** — Déplace un fichier ou le contenu d'un dossier. Utilise `rename` en priorité pour les performances, avec fallback sur copy+remove en cas d'échec. Supporte le filtrage par regex et ne supprime le dossier source que si tous les fichiers ont été déplacés.

- **`rm(location)`** — Supprime un fichier ou dossier de manière récursive en utilisant `fs-extra.removeSync`.

#### Opérations de listage

- **`ls(location, regex)`** — Liste tous les éléments d'un dossier avec filtrage optionnel par regex.

- **`lsdir(location, regex)`** — Liste uniquement les sous-dossiers avec filtrage optionnel par regex.

- **`lsfile(location, regex)`** — Liste uniquement les fichiers (non-dossiers) avec filtrage optionnel par regex.

- **`lsall(location, followSymlink = false, filter = null)`** — Liste récursivement tous les éléments d'une arborescence. Le paramètre `followSymlink` détermine si les liens symboliques sont suivis. Le paramètre `filter` accepte une fonction `(item, stats) => boolean` pour un filtrage personnalisé.

#### Opérations spécialisées

- **`batch.cp(cb, location)`** — Applique une opération de copie par lot avec un callback de transformation des noms. Le callback reçoit `(location, filename)` et retourne le nouveau nom ou `null` pour ignorer.

- **`batch.mv(cb, location)`** — Applique une opération de déplacement par lot avec un callback de transformation des noms.

- **`shasum(location, regex, sed, sha = null)`** — Calcule une somme de contrôle SHA256 récursive d'une arborescence. Supporte le filtrage par regex ou fonction, et la transformation des données via le paramètre `sed`. Gère correctement les liens symboliques en incluant leur cible dans le calcul.

- **`sed(file, regex, newValue)`** — Effectue une substitution de texte dans un fichier. Ignore automatiquement les fichiers binaires détectés par `isbinaryfile`. Retourne `true` si le fichier a été modifié, `false` sinon.

- **`newerFiles(location, regex, mtime)`** — Vérifie récursivement si des fichiers dans une arborescence sont plus récents qu'une date donnée (`mtime`). Retourne `true` dès qu'un fichier plus récent est trouvé.

#### Utilitaires

- **`canExecute(file)`** — Vérifie si un fichier a les permissions d'exécution en testant le bit d'exécution du propriétaire.

- **`rmSymlinks(location)`** — Supprime récursivement tous les liens symboliques d'une arborescence sans affecter les fichiers réguliers.

- **`rmFiles(location)`** — Supprime récursivement tous les fichiers et liens symboliques d'une arborescence, mais préserve la structure des dossiers.

#### Fonctions internes

La fonction `cpFile` implémente une copie de fichier optimisée par chunks de 64KB, préservant les permissions et gérant correctement les liens symboliques. Elle utilise des descripteurs de fichiers bas niveau pour optimiser les performances.

La fonction `batch` fournit le mécanisme de traitement par lot utilisé par `batch.cp` et `batch.mv`. Elle parcourt récursivement l'arborescence et applique le callback de transformation sur chaque fichier.

Le module expose également `fse` (fs-extra) pour un accès direct aux fonctionnalités de base si nécessaire.

#### Gestion des erreurs

Le module inclut une gestion robuste des erreurs :

- **ENOENT** : Fichiers/dossiers inexistants sont ignorés silencieusement dans certains contextes
- **EPERM** : Erreurs de permissions sont gérées spécifiquement dans les opérations par lot
- **Fallback automatique** : Les opérations de déplacement utilisent copy+remove si `rename` échoue

---

_Documentation mise à jour_
