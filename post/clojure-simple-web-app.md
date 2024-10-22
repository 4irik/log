# Пишем простое web-приложение на Clojure

Давно задумывался о том чтобы написать что-нибудь на чём-то вроде Lisp (кажется, с тех пор как прочитал перевод статьи о том как ещё в 1996, в США, люди делали на нём что-то вроде интернет-магазинов и тех, кто писал на С/С++, за конкурентов вообще не считали :D (кстати, никто не даст ссылку на неё?)). Даже свою [реализацию](https://github.com/4irik/lisphp) написал. Собственно, её я и думал использовать, и, заодно, доработать моменты которые вылезут в процессе. Но вот что мне это даст в плане возможностей поиска работы? Да, я лучше пойму как писать программы с большим количеством скобок :D, но не более, а надо бы ещё знать какие-либо инструменты, особенности языка и инструментов. В общем: может быть, когда-нибудь.

Я уже некоторое кол-во лет, периодически, посматриваю на Clojure и Haskell, даже пробовал на втором писать hello-world'ы (и даже писать на PHP в функциональном стиле, но это было: во-первых сложно читаемо, во-вторых окружающие смотрели на код вот так `:-[ ]` а на меня с сожалением %) ). Есть ещё сам Lisp Scheme и Racket, но, на сколько я знаю, из функциональных языков, только Clojure и Haskell, сейчас, хоть как-то используются за пределами университетов.

## Требования к ПП

 Реализовать CRUD-приложение с данными пациента.

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

## Подготовка

### Инфраструктура

Будем, как всегда, работать через Docker. Т.к. у нас, кроме самой Clojure есть ещё и СУБД, то используем `docker compose`. 

Посмотрим есть ли что среди Docker-образов. Есть, образ, даже, официальный - https://hub.docker.com/_/clojure. Читаем: 

> 1. leiningen⁠
>    1. The oldest and probably most common tool

этот подходит, берём последнюю версию. Сразу же берём и pgsql:

*docker-compose.yml:*

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

*Конфиг для postgres взял из примера на странице хаба.*

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

*shell:*

```shell
$ make start && make shell
$ lein new patient
```

получилось что-то вроде этого:

*shell:*

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

*shell:*

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


*Makefile:*

```Makefile
test: ## Run app tests
	docker compose exec app lein test
```

Заглянем в файл `core.clj`:

*core.clj:*

```clj
(ns patient.core)

(defn foo
"I don't do a whole lot."
  [x]
  (println x "Hello, World!"))
```

Для того чтобы у нас что-то скомпилировалось надо добавить функцию `-main`:

*core.clj:*

```clj
(ns patient.core)

(defn -main
  [& args]
  (println "Hello, World!"))

(defn foo
;; ...
```

Теперь попробуем это всё собрать и запустить:

*shell:*

```shell
$ lein run -m patient.core
Hello, World!
```

Добавляем команду запуска в `Makefile`:

*Makefile:*

```Makefile
run: ## Run application
	docker compose exec app lein run -m patient.core
```

### Редактор

У меня уже стоял Emacs и даже был немного преднастроен. Уже не помню для чего. Укажу часть `init.el` относящуюся к этому проекту:

*init.el:*

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

Отлично! Хорошо бы ещё не вводить эту строчку каждый раз когда нужен `REPL`, но этим займёмся потом. 

## Реализация

Собственно, т.к. писать я всё собрался на Clojure и ClojureScript, то, легче будет если решать задачи постепенно. Пока я ещё не знаю ни как писать фронт ни как писать бэк. Хочу начать с бэка, т.к. он мне более понятен (да и не будет ничего работать без него :D). 

Если поискать как можно на Clojure сделать web-сервис то можно найти и [примеры](https://github.com/chris-emerson/rest_demo) (к которым хорошо бы ещё иметь описание того что там и зачем) реализации и [библиотеки](https://github.com/metosin/reitit) которые многое на себя берут.

Мне хотелось бы собрать всё самому, так что в примеры я буду подглядывать а библиотеки, которые уже всё могут, использовать не буду, что бы, так сказать, лучше прочувствовать каково это.

### Backend

#### Minimal app

Недолгий поиск привёл меня на страничку ["Введение в веб-разработку на Clojure"](https://grishaev.me/clj-book-web-1/). В прошлый раз [статья](https://grishaev.me/clj-repl-part-1/) этого автора мне уже помогла когда я делал для своего [REPL'а](https://github.com/4irik/lisphp) многострочный ввод (собственно и саму идею его сделать я оттуда почерпнул). Бегло прочитав статью решил что буду следовать ей.

Напишем начальную реализацию приложения:

*core.clj:*

```clj
;; ...

(defn app
  [request]
  (let [{:keys [uri request-method]} request]
    {:status 200
     :headers {"Content-Type" "text/plain"}
     :body (format "You requested %s %s"
                   (name request-method)
                   uri)}))
```

Чтобы проверить как эта функция работает нужно её скомпилировать, для этого ставлю курсор на последнюю скобку и нажимаю `C-x C-e`, затем перехожу в `REPL` (`C-c C-z`) и вызываем её:

*REPL:*

```clj
patient.core> (app {:request-method :get :uri "/index.html"})
{:status 200,
 :headers {"Content-Type" "text/plain"},
 :body "You requested get /index.html"}
```

Всё работает. Двигаемся дальше.

#### Web-сервер

Добавим в зависимости два пакета:

*project.clj:*

```clj
;; ...
:dependencies [[org.clojure/clojure "1.12.0"]
               ;; base web-app
               [ring/ring-core "1.12.2"]
               ;; web-server
               [ring/ring-jetty-adapter "1.12.2"]
               ]
```

Чтобы их скачать нужно запустить `lein deps`. Добавим сразу эту команду в `Makefile`:

*Makefile:*

```Makefile
deps: ## Upload dependencies
	docker compose exec app lein deps
```

Сделаем так, чтобы сервер стартовал при запуске нашего приложения через `lein`.

*core.clj:*

```clj
;; ...

(require '[ring.adapter.jetty :refer [run-jetty]])

;; ...

(defn -main
  [& args]
  (run-jetty app {:port 8080 :join? true}))
```

прокинем порт `8080` из докера во вне:

*docker-compose.yml:*

```yml
services:
    app:
        # ...      
        ports:
            - 9911:9911
            - 8080:8080
```

и запустим наше приложение:

*shell:*

```shell
$ make restart && make run
Retrieving org/apache/commons/commons-parent/52/commons-parent-52.pom from central
Retrieving org/eclipse/jetty/jetty-project/11.0.21/jetty-project-11.0.21.pom from central
Retrieving com/fasterxml/jackson/jackson-bom/2.17.0/jackson-bom-2.17.0.pom from central
...
SLF4J: No SLF4J providers were found.
SLF4J: Defaulting to no-operation (NOP) logger implementation
SLF4J: See https://www.slf4j.org/codes.html#noProviders for further details.
```

Ошибок нет, и если зайти на `http://127.0.0.1:8080` то увидим:

```text
You requested get /
```

Тут видно что функция `app` отработала вернув метод запроса и URL.

**Небольшое отступление к инфраструктуре:**

Всё работает, но сейчас, т.к. я сижу с мобильного интернета, мне более важно другое: идёт скачивание всякого, скачивается всякое, естественно, в директорию внутри docker-образа, изменения в которой не сохраняются между запусками. Так мы каждый раз будем всё скачивать. Надо что-то делать. Всё в [той же статье](https://grishaev.me/clj-repl-part-4/#nrepl-в-docker) есть целых два решения:

1. прокинуть `/root/.m2` во вне
2. в профиль `:docker` добавить параметр `:local-repo`

Если пойти по второму пути то нужно будет всё и всегда запускать с указанием этого профиля, иначе всё что будет скачиваться будет скачиваться внутрь docker-контейнера. Первый же путь избавляет от необходимости помнить о параметрах запуска чего бы то ни было. Выбираем его.

*docker-compose.yml:*

```yml
services:
    app:
        # ...
        volumes:
            - ./:/app
            - ./.m2:/root/.m2
```

*Теперь возвращаемся к нашему web-приложению*

#### Роутинг

Теперь, когда у нас что-то заработало, пора подумать о роутинге. Всё в той же статье автор описывает два варианта:

1. Compojure
2. Bidi

И чуть ниже пишет:

> По субъективным ощущениям, с Compojure легче начать. У библиотеки достойная документация с примерами.

Мне этого достаточно. Выбираю Compojure.

*project.clj:*

```clj
(defproject patient "0.1.0-SNAPSHOT"
  ;; ...
  :dependencies [
                  ;; ...
                  [compojure "1.7.1"]
                ]
  ;; ...
```

У меня уже есть в Makefile команда для установки зависимостей, так что не нужно лезть в сам контейнер, достаточно отправить в shell `make deps`.

Напишем базовые роуты для нашего приложения. Т.к. у нас CRUD то, для работы с данными пациентов, нам нужно:

1. [ ] - GET - для просмотра списка записей
1. [ ] - POST - для создания записи
1. [ ] - GET - для просмотра записи
1. [ ] - PATCH - для внесения правок
1. [ ] - DELETE - для удаления

*Я разделил доступ к разной функциональности по HTTP-запросам чтобы проще было воспринимать, что каждый из запросов делает. Позже, возможно, я поменяю это.*

Напишем функции-заглушки для этих методов:

*core.clj:*

```clj
(defn patient-list
  [request]
    {:status 200
    :headers {"content-type" "text/plain"}
    :body "list of patients"})

(defn patient-view
  [request]
    {:status 200
    :headers {"content-type" "text/plain"}
    :body "view patient data"})

;; ...
```

Так, пока мы не ушли далеко, немного упростим себе жизнь. Каждая функция возвращает одну и ту же структуру:

```clj
{
  :status 200
  :headers {"content-type" "text/plain"}
  :body "some string"
}
```

в которой только значение кейворда `:body` различается. Сделаем функцию-хэлпер:

*core.clj:*

```clj
(defn make-response
  [response-string]
   {:status 200
   :headers {"content-type" "text/plain"}
   :body response-string})

(defn patient-list
  [request]
  (make-response "list of patients"))

(defn patient-view
  [request]
  (make-response "view patient data"))

;;...
```

Сразу же проверим её работу:

*REPL:*

```clj
patient.core> (make-response 123)
{:status 200, :headers {"content-type" "text/plain"}, :body 123}
patient.core> (patient-list [])
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "list of patients"}
```

Compojure предоставляет маркос для написания роутов - `defroutes`, можно писать и без него, но получится немного длиннее (пример с использованием маркоса и без него можно найти в [документации](https://github.com/weavejester/compojure/wiki/Routes-In-Detail#combining-routes)). Опишем наши роуты:

*core.clj:*

```clj
;;...
(require '[compojure.core :refer [GET POST PATCH DELETE defroutes]])

;; ...

(defroutes app
  (GET "/"      request (patient-list request))
  (GET "/patient/:id" request (patient-view request))
  (POST "/patient" request (patient-create request))
  (PATCH "/patient/:id" request (patient-update request))
  (DELETE "/patient/:id" request (patient-delete request))
  page-404)
```

Хм.. у нас тут есть группа роутов, это те что начинаются на `/patient`, можно их объединить:

*core.clj:*

```clj
;; ...
;; в конец добавлен макрос `context`
(require '[compojure.core :refer [GET POST PATCH DELETE defroutes context]]) 

;; ...

(defroutes app
  (GET "/"      request (patient-list request))
  (context "/patient" []
           (POST "/" request (patient-create request))
           (context "/:id{[0-9]+}" [id]
                    (GET "/" request (patient-view request))
                    (PATCH "/" request (patient-update request))
                    (DELETE "/" request (patient-delete request))
                    )
           )
  page-404)
```

тут, как видно, добавился ещё 1 маркос - `context`, а так же, я указал что `id` - это только цифры и он будет доступен в нижестоящих роутах под кейвордом `:id`. Кстати, давайте выведем этот самый `:id` в ответах роутов:

*core.clj:*

```clj
(defn patient-view
  [request]
  (when-let [user-id (-> request :params :id)]
  (make-response (format "view patient #%s data" user-id))))

;; ...
```

Проверим:

*shell:*

```shell
$ curl http://127.0.0.1:8080/patient/1
view patient #1 data
$ curl --request POST http://127.0.0.1:8080/patient
new patient created
```

Как видно, я использовал шаблон `%s` вместо `%d`, это потому, что параметр `:id` - объект класса `String`, позже я, думаю, ещё вернусь к этому моменту и поменяю его на класс `Integer`.

Итого, сейчас имеем:

- [x] роуты для CRUD пациента
- [x] подстановку `ID` пациента в роутах
- [x] роут для показа списка пациентов
- [x] обработку 404
- [ ] роут для поиска пациентов
- [ ] пагинация списка/поиска
- [ ] HATEOAS

Оставшиеся два пункта пока оставлю, так же как и оставлю на потом работу с HATEOAS (тут я уже подумываю о том что это будет, всё-таки, REST-приложение).

#### Хранение данных. Первый подход

Итак. Надо как-то хранить данные. В задании у нас указан PostgreSql, и я даже добавил его уже в docker-compose.yml, но пока что я не готов с головой окунуться в работу с ним. Хочется пока что сделать заглушку которая будет всё хранить в памяти.

Что, в итоге я хочу получить:

- [ ] получение всех записей (?)
- [ ] пагинация
- [ ] поиск записей (?)
- [ ] добавление новой записи
- [ ] удаление записи
- [ ] получение конкретной записи
- [ ] обновление записи

*Я поставил знак вопроса в скобках у пунктов которые я не уверен что нужно делать или пока не знаю в каком виде я хочу их видеть.*

Нашёл [статью](https://adambard.com/blog/diy-nosql-in-clojure/) с описанием как ~~из го~~ подручными средствами сделать себе стор. 

##### Добавление новой записи

Пока что сделаю по аналогии без попытки вникнуть что там и как:

*data.clj:*

```clj
(ns patient.data)

;; "Tables"
(def patients (atom []))

;; "Schema"
(def patient-keys [:fio :sex :date-of-birth :address :oms-number])

(defn get-patients
  []
  @patients)

(defn get-patient
  [id]
  (nth @patients id))

(defn put-patient!
  [patient]
  (swap! patients (conj patients patient)))
```

Тут же попробуем это дело:

*REPL:*

```clj
patient.core> (ns patient.data)
nil
patient.data> (get-patients)
[]
patient.data> (put-patient! {:fio "Иванов И.И" :sex true :date-of-birth "10.10.1910" :address "Some address 11" :oms-number "11223344"})
Execution error (ClassCastException) at patient.data/put-patient! (form-init12253400653348000048.clj:19).
class clojure.lang.Atom cannot be cast to class clojure.lang.IPersistentCollection (clojure.lang.Atom and clojure.lang.IPersistentCollection are in unnamed module of loader 'app')
```

Ну, функция `get-patients` работает, а вот со вставкой, пока проблемы. Почитаем что там, вообще, в оригинальном посте делается при вставке:

```clj
(def MAX-TWITS 5)

(def twits (atom []))

(def twit-keys [:name :message :timestamp])
(defn clean-twit [twit]
  (-> twit
    (select-keys twit-keys)
    (assoc :timestamp (System/currentTimeMillis))))

(defn put-twit! [twit]
    (swap! twits #(take MAX-TWITS (conj % (clean-twit twit)))))
```

Так. Выдвинем предположения:

- `take` берёт только `MAX-TWITS` из всего набора
- `conj` - добавляет запись в конец вектора
- `clean-twit` - добавляет в твит текущее время в миллисекундах
 - `swap!` - обновляет вектор `twits`

теперь выпишем непонятные вещи:

- `conj % ...` - почему тут не `twits` и что значит `%`?
- `#(take ...` - без понятия что эта запись означает.

Я пытался найти что такое `%`, но ответ был в ответе на другой вопрос - что такое `#(...`.  Итак:

- `#(take ...` - особая форма записи анонимной функции, можно было бы писать `(fn [arg ] ...)`
- `%` - подстановка параметра в особой форме записи анонимной функции, если бы параметров было несколько то они бы обозначались цифрами - `%1` `%2` и т.д.

Получается что `#(take...)` - анонимная функция, которая принимает 1 аргумент и её результат подставляется вместо в `twits`. Но откуда она берёт свой аргумент? Почитаем что там [пишут](https://clojuredocs.org/clojure.core/swap!) про `swap!`:

> (swap! atom f)
>
> Atomically swaps the value of atom to be:
> (apply f current-value-of-atom args).

Т.е. наша анонимная функция будет применена к значению атома. Вот и ответ.

Хорошо, попробуем переписать функцию `put-patient!`:

*data.clj:*
```clj
(defn put-patient!
  [patient]
  (swap! patients #(conj % patient)))
```

*REPL:*

```clj
patient.data> (put-patient! {:fio "Иванов И.И" :sex true :date-of-birth "10.10.1910" :address "Some address 11" :oms-number "11223344"})
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}]
```

Работает! Вот только я всё равно не понял почему `(conj patients patient)` не работает а `(conj % patient)` делает то что нужно, пока буду предполагать что `%` - это `current-value-of-atom`, т.е. не сам атом а значение содержащееся в нём. Кстати, как это можно проверить?

Нагуглил конструкцию `defer` (имеет сокращённую форму - `@`) которая возвращает значение атома. Проверим:

*REPL:*

```clj
patient.data> (conj patients {:test "test"})
Execution error (ClassCastException) at patient.data/eval12859 (form-init12253400653348000048.clj:92).
class clojure.lang.Atom cannot be cast to class clojure.lang.IPersistentCollection (clojure.lang.Atom and clojure.lang.IPersistentCollection are in unnamed module of loader 'app')
patient.data> (conj @patients {:test "test"})
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:test "test"}]
```

Ну что ж, предположение оказалось верным. Но если посмотреть примеры в документации, то, кажется, что можно сделать ещё проще:

*REPL:*

```clj
patient.data> (swap! patients conj {:test "test"})
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:test "test"}]
```

Так и запишем в нашей функции добавления новых записей:

*data.clj:*

```clj
(defn put-patient!
  [patient]
  (swap! patients conj patient))
```

##### Удаление записи

*data.clj:*

```clj
(defn del-patient!
  [id]
  (swap! patients ???))
```

 И что же тут можно сделать? Первая мысль - `filter`, но он работает только со значениями, а у меня индекс в векторе. Нашёл решение на [StackOverflow](https://stackoverflow.com/questions/1394991/clojure-remove-item-from-vector-at-a-specified-location) - использовать `subvec` и `concat`! Попробуем, сначала в общем виде:

 *REPL:*

 ```clj
patient.data> (def m [0 1 2 3 4 5 6 7 8 9])
#'patient.data/m
patient.data> (#(vec (concat (subvec %1 0 %2) (subvec %1 (+ 1 %2)))) m 2)
(0 1 3 4 5 6 7 8 9)
 ```

 Работает, перенесём это в файл:

 *data.clj:*

 ```clj
(defn del-patient!
  [id]
  (swap! patients #(vec (concat (subvec %1 0 %2) (subvec %1 (+ 1 %2)))) id))
```

 *REPL:*

 ```clj
;; посмотрим что у нас уже хранится
patient.data> (get-patients)
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:test "test"}
 {:fio "Петров П.П",
  :sex true,
  :date-of-birth "11.11.1911",
  :address "Some address 222",
  :oms-number "22334455"}]
;; удалим запись под индексом `1`
patient.data> (del-patient! 1)
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:fio "Петров П.П",
  :sex true,
  :date-of-birth "11.11.1911",
  :address "Some address 222",
  :oms-number "22334455"}]
;; пропала запись `{:test "test"}`
```

*Тут наметилась проблема: если я удаляю запись то следующая за ней занимает её место, это создаст проблемы когда мы будем удалять записи через web-приложение потому как клиент не будет знать что **идентификаторы записей поменялись**, либо надо будет отправлять ему, каждый раз, новые идентификаторы.*

Оставим её пока, вернёмся когда доделаем все CRUD операции. *Кажется, что это решение добавит мне потом работы, но уж очень хочется продвинуться хоть немного вперёд.*

##### Обновление записи

Кажется что обновление записи очень похоже на удаление, с той только разницей что вместо удаляемого элемента нужно подставить новый:

*data.clj:*

```clj
(defn upd-patient!
  [id patient]
  (swap! patients #(vec (concat (subvec %1 0 %2) [%3] (subvec %1 (+ 1 %2)))) id patient))
```

*REPL:*

```clj
;; заменим адрес у пациента номер 2
patient.data> (upd-patient! 1 {:fio "Петров П.П." :sex true :date-of-birth "11.11.1911" :address "new some address 333" :oms-number "22334455"})
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:fio "Петров П.П.",
  :sex true,
  :date-of-birth "11.11.1911",
  :address "new some address 333",
  :oms-number "22334455"}]
```

Работает, но есть две вещи которые мне не нравятся:

1. нужно указывать индекс пациента (проблема связанная с этим уже подсвечена в предыдущем параграфе)
1. нужно слать полный набор данных

Попробуем, пока что, разобраться с проблемой №2.

Конструкция(?) `assoc` позволяет изменить значение в отображении (`map`):

*data.clj:*

```clj
(defn change-patient-one-value!
  "Изменят одно значение в записи пациента"
  [item key new-value]
  (assoc item key new-value))
```

*REPL:*

```clj
patient.data> (change-patient-one-value! {:test "test"} :test "new value")
{:test "new value"}
```

Дальше, кажется что можно получить на вход мапу с изменениями и, через её редукцию, обновить данные пациента:

*data.clj:*

```clj
(defn change-patient-values!
  "Изменяет значения в записи пациента"
  [patient new-values-map]
  (reduce
   #(let [key (%2 0) val (%2 1)] (change-patient-one-value! %1 key val))
   patient
   (seq new-values-map)))
```

*REPL:*

```clj
patient.data> (change-patient-values! {:t1 "test 1" :t2 "test 2" :t3 "test 3"} {:t1 "new test 1" :t3 "new test 3"})
{:t1 "new test 1", :t2 "test 2", :t3 "new test 3"}
```

Осталось это всё собрать в одном месте:

*data.clj:*

```clj
(defn upd-patient!
  "Обновляет данные пациента (можно передавать только обновлённые поля)"
  [id new-data-of-patient]
  (swap!
   patients
   #(vec
     (concat
      (subvec %1 0 %2)
      [(change-patient-values! %3 %4)]
      (subvec %1 (+ 1 %2))))
   id
   (@patients id)
   new-data-of-patient))
```

*REPL:*

```clj
patient.data> (upd-patient! 1 {:oms-number "556677"})
[{:fio "Иванов И.И",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "Some address 11",
  :oms-number "11223344"}
 {:fio "Петров П.П.",
  :sex true,
  :date-of-birth "11.11.1911",
  :address "new some address 333",
  :oms-number "556677"}]
```

##### Получение данных конкретной записи

Я уже сделал этот метод, слизав его из статьи которую упомянул в начале:

*data.clj:*

```clj
(defn get-patient
  [id]
  (nth @patients id))
```

но тогда я не понимал как это работает. Сейчас, уже зная про атомы и `defer` я не знаю только что делает `nth`. Заглянем в [документацию](https://clojuredocs.org/clojure.core/nth):

> Returns the value at the index. get returns nil if index out of
bounds, nth throws an exception unless not-found is supplied.

т.е. если я укажу индекс не входящий в вектор то получу исключение. Кажется это то что нужно, я пока не знаю как буду его обрабатывать но мне хотелось бы знать что что-то идёт не так.

*REPL:*

```clj
patient.data> (get-patient 0)
{:fio "Иванов И.И",
 :sex true,
 :date-of-birth "10.10.1910",
 :address "Some address 11",
 :oms-number "11223344"}
patient.data> (get-patient 2)
Execution error (IndexOutOfBoundsException) at patient.data/get-patient (form-init12253400653348000048.clj:15).
null
```

##### Подведём итог

- [x] получение всех записей (?)
- [ ] пагинация
- [ ] поиск записей (?)
- [x] добавление новой записи
- [x] удаление записи
- [x] получение конкретной записи
- [x] обновление записи

Из запланированного почти всё сделано. Оставшиеся два пункта я пока оставлю, хочется уже чтобы приложение заработало хоть в каком-то виде.

#### Minimal app: Добавляем хранение данных.

Начнём с добавления новой записи, потом, думаю, проверим как работает вывод всех пациентов и данных конкретного пациента, затем уже займёмся обновлением и удалением записей. Напишем список чтобы в конце с ним свериться:

- [ ] добавление нового пациента
- [ ] получение списка пациентов
- [ ] пагинация списка пациентов
- [ ] поиск пациентов
- [ ] получение данных пациента
- [ ] обновление данных пациента
- [ ] удаление данных пациента

##### Добавление

Итак, для начала, хочется видеть что данные приходят. Для этого нужно взять данные из `body` из запроса, на помощь, как всегда, приходит StackOverflow, будем использовать `slurp` для того чтобы [превратить поток в строку](https://stackoverflow.com/a/68544475):

*core.clj:*

```clj
(defn patient-create
  [request]
  (make-response (slurp (:body request))))
```

А на странице документации по `slurp` я нашёл [подсказку](https://clojuredocs.org/clojure.core/slurp#example-588dd268e4b01f4add58fe33) о том, как это всё можно проверить в REPL: 

*REPL:*

```clj
patient.core> (patient-create {:body (into-array Byte/TYPE ":test 123")})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body ":test 123"}
```

*shell:*

```shell
$ curl --request POST http://127.0.0.1:8080/patient --data ":fio \"Сидоров С.С.\" :sex true :date-of-birth \"01.01.1901\" :address \"sidorov s.s. address 1\" :oms-number \"778899\""
:fio "Сидоров С.С." :sex true :date-of-birth "01.01.1901" :address "sidorov s.s. address 1" :oms-number "778899"
```

Отлично!

Теперь нужно эту строку превратить в мапу. К счастью, ответ [быстро нашёлся](https://stackoverflow.com/a/35707024):

*REPL:*

```clj
patient.core> (clojure.edn/read-string "{:a 1 :b 2}")
{:a 1, :b 2}
```

*core.clj:*

```clj
(require '[patient.data :as db])

;; ...

(defn patient-create
  [request]
  (let
      [patient-raw (slurp (:body request))
       patient-map (clojure.edn/read-string (str "{" patient-raw "}"))]
    (db/put-patient! patient-map))
  (make-response nil))
```

*REPL:*

```clj
patient.core> (patient-create {:body (into-array Byte/TYPE ":test 123")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
```

*shell:*

```shell
$ curl -D - --request POST http://127.0.0.1:8080/patient --data ":fio \"Сидоров С.С.\" :sex true :date-of-birth \"01.01.1901\" :address \"sidorov s.s. address 1\" :oms-number \"778899\""
HTTP/1.1 200 OK
Date: Wed, 16 Oct 2024 10:36:01 GMT
Content-Type: text/plain
Content-Length: 0
Server: Jetty(11.0.21)
```

##### Список всех пациентов

Кажется, что нужно просто получить данные всех пациентов и вывести их в каком-то виде:

*core.clj:*

```clj
(defn patient-list
  [request]
  (make-response (db/get-patients)))
```

*REPL:*

```clj
patient.core> (patient-create {:body (into-array Byte/TYPE ":test 123")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
patient.core> (patient-create {:body (into-array Byte/TYPE ":test 222")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
patient.core> (patient-create {:body (into-array Byte/TYPE ":test 333")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
patient.core> (patient-list [])
{:status 200,
 :headers {"content-type" "text/plain"},
 :body [{:test 123} {:test 222} {:test 333}]}
```

*shell:*

```shell
$ curl http://127.0.0.1:8080
<html>
<head>
<meta http-equiv="Content-Type" content="text/html;charset=ISO-8859-1"/>
<title>Error 500 java.lang.IllegalArgumentException: No implementation of method: :write-body-to-stream of protocol: #&apos;ring.core.protocols/StreamableResponseBody found for class: clojure.lang.PersistentVector</title>
```

Похоже что нужно превратить вектор из отображений в строку:

*REPL:*

```clj
patient.core> (str [{:test 123} {:test 222} {:test 333}])
"[{:test 123} {:test 222} {:test 333}]"
```

*core.clj:*

```clj
(defn patient-list
  [request]
  (make-response (str db/get-patients)))
```

*REPL:*

```clj
patient.core> (patient-list [])
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "patient.data$get_patients@185b5398"}
```

Хм... получилось немного не то на что я рассчитывал, наверное это потому что в `str` я передал не результат функции а саму функцию. 

*core.clj:*

```clj
(defn patient-list
  [request]
  (make-response (str (db/get-patients))))
```

*REPL:*

```clj
patient.core> (patient-list [])
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "[{:test 123} {:test 222} {:test 333}]"}
```

*shell:*

```shell
$ curl --request POST http://127.0.0.1:8080/patient --data ":fio \"Сидоров С.С.\" :sex true :^Cte-of-birth \"01.01.1901\" :address \"sidorov s.s. address 1\" :oms-n
umber \"778899\""
$ curl --request POST http://127.0.0.1:8080/patient --data ":fio \"Петров П.П.\" :sex true :date-of-birth \"10.10.1910\" :address \"petrov p.p. address 1\" :oms-number \"112233\""
$ curl http://127.0.0.1:8080
[{:fio "Сидоров С.С.", :sex true, :date-of-birth "01.01.1901", :address "sidorov s.s. address 1", :oms-number "778899"} {:fio "Петров П.П.", :sex true, :date-of-birth "10.10.1910", :address "petrov p.p. address 1", :oms-number "112233"}]
```

Хорошо. Список пациентов, в каком-то виде, уже есть.

##### Получение данных конкретного пациента

Тут действуем по аналогии с предыдущим пунктом:

*core.clj:*

```clj
(defn patient-view
  [request]
  (let [patient-id (-> request :params :id)]
    (let [patient (db/get-patient patient-id)]
      (if patient
        (make-response (str patient))
        (page-404 [])))))
```

*REPL:*

```clj
patient.core> (patient-view {:params {:id 2}})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "{:test 333}"}
patient.core> (patient-view {:params {:id 3}})
Execution error (IndexOutOfBoundsException) at patient.data/get-patient (data.clj:17).
null
```

Так, не нравится мне что вместо 404 я вижу исключение. В прошлой главе я специально так сделал, чтобы стор кидал исключение если запись не найдена, тогда мне показалось, что при разработке было бы удобно получать исключение если данные не найдены. Я так решил, потому как не был уверен, что смогу понять где у меня вернулся `nil`: потому, что я что-то не так сделал или потому, что данных нет в сторе. Сейчас же мне совершенно не хочется писать обработку исключений для случая который может часто встречаться. Переделаем стор чтобы он возвращал `nil` если ничего не найдено:

*data.clj:*

```clj
(defn get-patient
  "Возвращает запись пациента по его ID"
  [id]
  (get @patients id))
```

Теперь всё должно быть ок:

*REPL:*

```clj
patient.core> (patient-view {:params {:id 1}})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "{:test 222}"}
patient.core> (patient-view {:params {:id 11}})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "No such a page."}
```

*shell:*

```shell
$ curl http://127.0.0.1:8080/patient/1
No such a page.
```

Так, это странно. Но если подумать, то:

*REPL:*

```clj
patient.core> (patient-view {:params {:id "1"}})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "No such a page."}
```

где-то выше я уже писал о том что `:id` - это объект класса `String`, вот и пришло время преобразовать его в `Integer`.

В Compojure есть такая штука - [parameter coercion](https://github.com/weavejester/compojure/wiki/Destructuring-Syntax#parameter-coercion):

*core.clj:*

```clj
;; ...

(require '[compojure.coercions :refer [as-int]])

;; ...

(defn patient-view
  [id]
  (let [patient (db/get-patient id)]
    (if patient
      (make-response (str patient))
      (page-404 []))))

;; ...

(defroutes app
;; ...
           (context "/:id{[0-9]+}" [id :<< as-int]
                    (GET "/" [] (patient-view id))
;; ...
```

Тут я сделал сразу две вещи:

1. Передал в `patient-view` только нужные ей параметры
1. Преобразовал `id` в `Integer` прямо в роуте 

в обоих случаях изменения сделанные в роуте помогли разгрузить целевую функцию избавив её от необходимости совершать действия напрямую не связанные с её назначением.

*Изначально я в роуте я написал `(GET "/" id (patient-view id))`, но вместо идентификатора передавалась мапа содержащая заголовок запроса. Пока не понял почему так.*

*shell:*

```shell
$ curl http://127.0.0.1:8080/patient/1
{:fio "Петров П.П.", :sex true, :date-of-birth "10.10.1910", :address "petrov p.p. address 1", :oms-number "112233"}
```

##### Обновление данных

*core.clj:*

```clj
(defn patient-update
  [id request]
  (let
      [patient-raw (slurp (:body request))
       patient-map (clojure.edn/read-string (str "{" patient-raw "}"))]
    (db/upd-patient! id patient-map))
  (make-response nil))

;; ...

(defroutes app
;; ...
                    (PATCH "/" request (patient-update id request))
;; ...
```

*REPL:*

```clj
;; добавим пациента
patient.core> (patient-create {:body (into-array Byte/TYPE ":fio \"Sidorov\" :address \"sidorov s.s. address 1\"")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
;; проверим что добавилось
patient.core> (patient-view 0)
{:status 200,
 :headers {"content-type" "text/plain"},
 :body
 "{:fio \"Sidorov\", :address \"sidorov s.s. address 1\"}"}
;; изменим адрес
patient.core> (patient-update 0 {:body (into-array Byte/TYPE ":address \"sidorov address 2\"")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
;; посмотрим, изменился ли адрес
patient.core> (patient-view 0)
{:status 200,
 :headers {"content-type" "text/plain"},
 :body
 "{:fio \"Sidorov\", :address \"sidorov address 2\"}"}
```

Работает, но тут возникает вопрос - "А что если указанной записи не существует?". 

*REPL:*

```clj
patient.core> (patient-update 10 {:body (into-array Byte/TYPE ":address \"sidorov address 3\"")})
Execution error (IndexOutOfBoundsException) at patient.data/upd-patient! (data.clj:53).
null
```

Можно было и в код заглянуть:

*data.clj:*

```clj
(defn upd-patient!
  ;; ...
   (@patients id)
  ;; ...
```

И тут же второй - "А как себя, в этом случае, поведёт PgSql?". Ответим на него:

*shell:*

```sql
patient_db=# CREATE TABLE test_table (id serial primary key, data text not null);
CREATE TABLE
patient_db=# INSERT INTO test_table ("data") VALUES ('some value 1'), ('some value 2'), ('some value 3');
INSERT 0 3
patient_db=# SELECT * FROM test_table;
 id |     data
----+--------------
  1 | some value 1
  2 | some value 2
  3 | some value 3
(3 rows)

patient_db=# UPDATE test_table SET data='111' WHERE id=1;
UPDATE 1
patient_db=# UPDATE test_table SET data='111' WHERE id=100;
UPDATE 0
patient_db=# SELECT * FROM test_table;
 id |     data
----+--------------
  2 | some value 2
  3 | some value 3
  1 | 111
(3 rows)
```

> [!NOTE]
> За кулисами я добавил в `Makefile` строку:
>
> *Makefile:*
>
> ```Makefile
> psql: ## PostgreSql shell
> 	docker compose exec db psql -U postgres -d patient_db
> ```

Т.е. видно что ничего страшного не происходит, СУБД просто возвращает кол-во изменённых записей. 

Т.к. я предполагаю что у меня слой хранения как-то связана с проектируемым доменом, то я не буду возвращать кол-во изменённых записей, а верну флаг того, удалось ли изменить запись или нет. Оба значения флага не говорят о какой либо ошибке, они оба нормальны, если будет какая-либо ошибка, то должно быть кинуто исключение.

*data.clj:*

```clj
(defn upd-patient!
  "Обновляет данные пациента (можно передавать только обновляемые поля)"
  [id new-data-of-patient]
  (def patient (get-patient id))
  (if (= nil patient)
    false
    (do
      (swap!
       patients
       #(vec
         (concat
          (subvec %1 0 %2)
          [(change-patient-values! %3 %4)]
          (subvec %1 (+ 1 %2))))
       id
       patient
       new-data-of-patient)
      true)))
```

*REPL:*

```clj
patient.data> @patients
[{:fio "Sidorov",
  :sex true,
  :date-of-birth "01.01.1901",
  :address "sidorov address 2",
  :oms-number "778899"}
 {:fio "Petrov",
  :sex true,
  :date-of-birth "10.10.1910",
  :address "sidorov address 3",
  :oms-number "112233"}]
patient.data> (upd-patient! 3 {:sex false})
false
patient.data> (upd-patient! 1 {:sex false})
true
patient.data> @patients
[{:fio "Sidorov",
  :sex true,
  :date-of-birth "01.01.1901",
  :address "sidorov address 2",
  :oms-number "778899"}
 {:fio "Petrov",
  :sex false,
  :date-of-birth "10.10.1910",
  :address "sidorov address 3",
  :oms-number "112233"}]
```

Как видно, всё обновляется.

*core.clj:*

```clj
(defn patient-update
  [id request]
  (def patient-raw (slurp (:body request)))
  (def patient-map (clojure.edn/read-string (str "{" patient-raw "}")))
  (if (db/upd-patient! id patient-map)
    (make-response nil)
    (page-404 [])))
```

*REPL:*

```clj
;; посмотрим данные пациента
patient.core> (patient-view 0)
{:status 200,
 :headers {"content-type" "text/plain"},
 :body
 "{:fio \"Sidorov\", :sex true, :date-of-birth \"01.01.1901\", :address \"sidorov address 2\", :oms-number \"778899\"}"}
;; имзеним у него пол
patient.core> (patient-update 0 {:body (into-array Byte/TYPE ":sex false")})
{:status 200, :headers {"content-type" "text/plain"}, :body nil}
;; удостоверимся что пол поменялся
patient.core> (patient-view 0)
{:status 200,
 :headers {"content-type" "text/plain"},
 :body
 "{:fio \"Sidorov\", :sex false, :date-of-birth \"01.01.1901\", :address \"sidorov address 2\", :oms-number \"778899\"}"}
;; изменим данные у несуществующего пациента
patient.core> (patient-update 1000 {:body (into-array Byte/TYPE ":sex false")})
{:status 200,
 :headers {"content-type" "text/plain"},
 :body "No such a page."}
;; как и ожидалось, мы увидили 404 (точнее ответ его заменяющий)
```

Теперь всё как надо. Остался только один момент: первые 2 строчки функци `patient-update` не относятся к её основному назначению:

*core.clj:*

```clj
(defn patient-update
  [id request]
  (def patient-raw (slurp (:body request)))
  (def patient-map (clojure.edn/read-string (str "{" patient-raw "}")))
  ;; ...
```

Функционал по вычленению данных пациента из запроса и формированию из них отображения мы можем вынести в [middleware](https://github.com/weavejester/compojure/wiki/Middleware):

*core.clj:*

```clj

;; добавляем `wrap-routes`
(require '[compojure.core :refer [GET POST PATCH DELETE defroutes context wrap-routes]])

;; ...

(defn patient-create
  [patient-data]
  (db/put-patient! patient-data)
  (make-response nil))

(defn patient-update
  [id patient-data]
  (if (db/upd-patient! id patient-data)
    (make-response nil)
    (page-404 [])))

(defn wrap-patient-data
  [handler]
  (fn
    [request]
    (let
        [patient-raw (slurp (:body request))
         patient-map (clojure.edn/read-string (str "{" patient-raw "}"))]
      (handler (assoc request :patient-data patient-map)))))

(defroutes app
  ;; ...
           (->
            (POST "/" {:keys [patient-data]} (patient-create patient-data))
            (wrap-routes wrap-patient-data))
            ;; ... 
                    (->
                     (PATCH "/" {:keys [patient-data]} (patient-update id patient-data))
                     (wrap-routes wrap-patient-data))  
                     ;; ...
  )
```

Как видно, я, заодно, исправил и код функции `patient-create`.

Сразу скажу что к записи роутов вида `(-> (...) (...))` я пришёл не сразу. Сначала я писал так:

```clj
(defroutes app
  ;; ...
           (wrap-patient-data
            (POST "/" {:keys [patient-data]} (patient-create patient-data)))
            ;; ... 
                    (wrap-patient-data
                     (PATCH "/" {:keys [patient-data]} (patient-update id patient-data)))  
                     ;; ...
  )
```

но у меня были проблемы с методом `PATCH` - в функицю `patient-update` значение параметра `id` передавалось как следует а вот `patient-data` был пустым отображением. Расставив принты я выяснил что middleware `wrap-patient-data`, в случае с `PATCH`, вызывается дважды. Сначала я не понимал почему так, но потом вспомнил:  middleware применяется до того как проверится подходит ли роут к запросу:

> If you want middleware to be applied only when a route matches ...

Избежать этого позволяет функция `wrap-routes` вкупе с макросом `->` позволяющим сделать цепочку вызовов.

##### Удаление

Тут всё просто, но есть одна загвоздка:

*REPL:*

```clj
patient.data> (get-patients)
[{:test "1"} {:test "2"} {:test "3"}]
patient.data> (del-patient! 5)
Execution error (IndexOutOfBoundsException) at patient.data/del-patient!$fn (form-init4821922077780103475.clj:27).
null
```

Сейчас мне ничего с этим делать не хочется, сделаю, пока что, проверку наличия записи в обработчике роута:

*core.clj:*

```clj
(defn patient-delete
  [id]
  (if (db/get-patient id)
    (do
      (db/del-patient! id)
      (make-response nil))
    (page-404 [])))

;; ...

(defroutes app
  ;; ...
  (context "/patient" []
           ;; ...
           (context "/:id{[0-9]+}" [id :<< as-int]
                    ;; ...
                    (DELETE "/" [] (patient-delete id))))
  ;; ...
  )
```

*shell:*

```shell
# посмотрим весь список 
$ curl http://127.0.0.1:8080
[{:fio "Петров П.П.", :sex true} {:fio "Сидоров С.С.", :sex true} {:fio "Иванов И.И.", :sex true}]
# удалим среднюю запись
$ curl --request DELETE http://127.0.0.1:8080/patient/1
# как видим записей осталось две
$ curl http://127.0.0.1:8080
[{:fio "Петров П.П.", :sex true} {:fio "Иванов И.И.", :sex true}]
# попробуем удалить несуществующую запись
$ curl --request DELETE http://127.0.0.1:8080/patient/10
No such a page.
```

##### Итоги

Смотрим что реализовано:

- [x] добавление нового пациента
- [x] получение списка пациентов
- [ ] пагинация списка пациентов
- [ ] поиск пациентов
- [x] получение данных пациента
- [x] обновление данных пациента
- [x] удаление данных пациента

Позже вернёмся к этому чек-листку, как, впрочем, и другим, а сейчас займёмся следующей частью нашего web-приложения!

<!-- #### Представление

JSON/XML/HTML в зависимости от заголовка запроса -->