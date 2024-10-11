# Пишем простое web-CRUD-приложение на Clojure

## Требования к ПП

 Реализовать CRUD пациента.

**Dataset:**

- ФИО пациента
- Пол
- Дата рождения
- Адрес
- Номер полиса ОМС

### Функционал

- [ ] просмотр списка пациентов
- [ ] поиск
- [ ] фильтрация
- [ ] создание
- [ ] удаление
- [ ] редактирование
- [ ] валидация

### Дополнительно

- без фреймворков
- использовать vim/emacs
- пишем тесты
- REPL-driven разработка
- CI
- подготовить продукт к развёртыванию в K8s
- в качестве СУБД PgSql

<!-- - в демо отразить:
  - как разрабатывал через repl
  - обосновать принятие ключевых решений -->

## Подготовка

### Инфраструктура

Будем, как всегда, работать через Docker. Т.к. у нас, кроме самой Clojure есть ещё и СУБД, то используем `docker compose`. 

Посмотрим есть ли что среди Docker-образов. Есть, образ даже официальный - https://hub.docker.com/_/clojure. Читаем: 

> 1. leiningen⁠
>    1. The oldest and probably most common tool

этот подходит, берём последнюю версию. Сразу же берём и pgsql:

```yml
services:
    app:
        image: clojure:temurin-23-lein-alpine
        restart: always
        working_dir: /app
        volumes:
            - ./:/app
    db:
        image: postgres:17.0-alpine3.20
        restart: always
        # set shared memory limit when using docker-compose
        shm_size: 128mb
        # or set shared memory limit when deploy via swarm stack
        #volumes:
        #  - type: tmpfs
        #    target: /dev/shm
        #    tmpfs:
        #      size: 134217728 # 128*2^20 bytes = 128Mb
        ports:
            - 5432:5432
        environment:
            POSTGRES_PASSWORD: pswd
            POSTGRES_DB: patient_db
            PGDATA: ./pgdata

```

~~! Почему temurin?~~

Тут же накидаем `Makefile`:

```make
help: ## Show this help
	@printf "\033[33m%s:\033[0m\n" 'Available commands'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[32m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build containers
	docker compose build

up: ## Run application
	docker compose up -d

down: ## Down application
	docker compose down

restart: down up ## Restart application

shell: ## Shell at clojure docker
	docker compose exec app bash

log: ## Show container logs
	docker compose logs -f
```

### Первые шаги

Т.к. в Clojure я новичок, то потребовалось некоторое время чтобы понять что `lein` - это [leiningen](https://leiningen.org/), сборщик проекта а не какая-то специфическая версия кложи. Поначалу я искал в docker-образе что-то вроде `clojure` и `clj` и не мог найти, потом всё встало на свои места.

Заходим в docker-образ и создаём каркас приложения:

```shell
$ make start && make shell
$ lein new patient
```

получилось что-то вроде этого:

```shell
$ tree
.
├── CHANGELOG.md
├── LICENSE
├── Makefile
├── README.md
├── doc
│   └── intro.md
├── docker-compose.yml
├── project.clj
├── resources
├── src
│   └── patient
│       ├── core.clj
├── target
│   ├── classes
│   │   └── META-INF
│   │       └── maven
│   │           └── patient
│   │               └── patient
│   │                   └── pom.properties
│   ├── repl-port
│   └── stale
│       └── leiningen.core.classpath.extract-native-dependencies
└── test
    └── patient
        └── core_test.clj

14 directories, 14 files
```

У нас есть тесты, попробуем их запустить:

```shell
$ lein test

lein test patient.core-test

lein test :only patient.core-test/a-test

FAIL in (a-test) (core_test.clj:7)
FIXME, I fail.
expected: (= 0 1)
  actual: (not (= 0 1))

Ran 1 tests containing 1 assertions.
1 failures, 0 errors.
Subprocess failed (exit code: 1)
```

Хорошо, что-то уже работает. Добавим запуск тестов в `Makefile`:

```Makefile
test: ## Run app tests
	docker compose exec app lein test
```

Заглянем в файл `core.glj`:

```clj
(ns patient.core)

(defn foo
"I don't do a whole lot."
  [x]
  (println x "Hello, World!"))
```

Для того чтобы у нас что-то скомпилировалось надо добавить функцию `-main`:

```clj
(ns patient.core)

(defn -main
  [& args]
  (println "Hello, World!"))

(defn foo
;; ...
```

Теперь попробуем это всё собрать и запустить:

```shell
$ lein run -m patient.core
Hello, World!
```

Добавляем команду запуска в `Makefile`:

```Makefile
run: ## Run application
	docker compose exec app lein run -m patient.core
```

### Редактор

У меня уже стоял Emacs и даже был немного преднастроен, уже не помню для чего. Укажу часть `init.el` относящуюся к этому проекту:

```lisp
(use-package cider
  :ensure t)

(use-package clojure-mode
  :ensure t)
```

Хорошо бы добавить REPL. Нагуглил эту статью - https://grishaev.me/clj-repl-part-4/#nrepl-в-docker. Делаем по ней:

*project.clj:*
```clj
(defproject patient "0.1.0-SNAPSHOT"
  ;; ...
  :profiles
  {:docker
	{:repl-options {:port 9911
		        :host "0.0.0.0"}
	:plugins [[cider/cider-nrepl "0.50.2"]]}})
```


*docker-compose.yml:*
```yml
services:
    app:
        command: ["lein", "with-profile", "+docker", "repl", ":headless"]
```

Перезапускаем наш docker-образ и пытаемся присоединиться в emacs:

```
M-x cider-connect RET 127.0.0.1 RET 9911 RET
```
![nRepl работает!](../assets/clojure-simple-web-app/repl-emacs-test.png)

Отлично! Хорошо бы ещё не вводить эту строчку каждый раз когда нужен `nRepl`, но этим займёмся потом. 

## Реализация

Собственно, т.к. писать я всё собрался на Clojure и ClojureScript, то, легче будет если решать задачи постепенно. Пока я ещё не знаю ни как писать фронт ни как писать бэк. Хочу начать с бэка, т.к. он мне более понятен. А чтобы не заморачиваться с шаблонизацией и ресурсами буду делать REST-сервис.

### REST-API

Если поискать как можно на Clojure сделать REST-сервис то можно найти и [примеры](https://github.com/chris-emerson/rest_demo) реализации и [библиотеки](https://github.com/metosin/reitit) которые многое на себя берут.

Мне хотелось бы собрать всё самому, так что в примеры я буду подглядывать а библиотеки которые уже всё могут использовать не буду, что бы, так сказать, лучше прочувствовать каково это.