# Создание идеального скринкаста работы с терминалом

Недавно выложил свою реализацию [lisp-интерпретатора](<https://github.com/4irik/lisphp>) 
написанного на PHP. И, чтобы можно было хотя
бы как-то посмотреть его работу ничего не запуская, решил прикрепить в readme
скринкаст работы в REPL.

Сразу покажу результат:

[![asciicast](https://asciinema.org/a/Tgr77lcJ13cXYGOuaDB3lyrOK.svg)](<https://asciinema.org/a/Tgr77lcJ13cXYGOuaDB3lyrOK>)

В принципе, в win11, уже всё для этого есть, но вводить текст без запинок
опечаток и с постоянной скоростью оказалось не очень-то и просто. "Нужно отдать
это дело на откуп программе!" - первая мысль посетившая меня после нескольких
 неудачных попыток.

Я использую WSL c Ubuntu для разработки и, уж чего-чего, а в линуксе 100% есть
или уже готовая программа или её можно собрать на коленке из bash-скриптов и
~~палок~~ того что найдём в `/usr/bin`.

Итак, мне нужно эмулировать ввод текста с клавиатуры. Недолгий поиск привёл меня
к `xdotool`. Есть только одна проблема:

```shell
xdotool --type "hello"
```

ничего не выводит, а если спросить

```shell
echo $? # 0
```

т.е. всё хорошо.

Выяснилось, что буква "x" в её названии не просто так, утилита работает только с
x11-приложениями. Stack Overflow подсказал её решение:

```shell
sudo apt install xterm
```

Благо WSL2 позволяет без проблем работать с GUI-приложениями линукса.  Все
дальнейшие эксперименты с `xdotool`, и сам скринкаст, я проводил в `xterm`.

Одна проблема решена, теперь надо как-то сделать так чтобы на экране появлялось
много строк. `xdotool` позволяет написать для неё последовательность команд и
передать её на вход файлом или из stdin.

```shell
cat scenario.txt | xdotool -
xdotool scenario.txt
```

Мне больше импонирует первый вариант, потому, что так можно будет генерировать
сценарий "на лету".

Итак, вручную я вводил в терминал что-то вроде этого:

```shell
$ make repl
?> ; First, let's see some help information.
?> :help
?> ; Let's write some code.
?> (defn sum (n a)
?> ..(cond (= n 0)
# …
?> ; Let's exit the REPL
?> :q
```

Видно, что нужно сделать две вещи:

- запустить REPL
- вводить в него различные строки

Для запуска программ в xdotool предлагают использовать такой синтаксис:

```text
exec program_name arg_1 
```

Запуск программы занимает какое-то время, нужно подождать пока она запустится и
продолжить ввод, иначе `xdotool` продолжит ввод не дожидаясь её готовности к
работе:

```text
sleep 1
```

Это заставит утилиту подождать 1 секунду.

Для ввода строк нам нужна такая команда:

```text
type "some string"
```

Ещё нам нужен перевод на новую строку:

```text
key Return
```

Таким образом, чтобы ввести команду в REPL нужно два вызова:

```text
type "some string"
key Return
```

Также нужно учесть, что, по-умолчанию, задержка ввода символов 12 мс. Это очень
мало, нужно чтобы было похоже на ввод человеком:

```text
type --delay 200 "some string"
```

Ещё нужно дать время зрителю прочитать строку целиком:

```text
key --delay 1000 Return
```

Итого получим:

```text
type --delay 200 "some string"
key --delay 1000 Return
```

Отлично, теперь можно представить как будет выглядеть сценарий:

```text
exec make repl
sleep 1
type --delay 200 "; First, let's see some help info"
key --delay 1000 Return
type --delay 200 ":help"
key --delay 1000 Return
type --delay 200 "; Let's write some code."
key --delay 1000 Return
type --delay 200 "(defn sum (n a)"
key --delay 1000 Return
type --delay 200 "(cond (= n 0)"
key --delay 1000 Return
…
```

Писать это всё вручную нет никакого желания, проще написать текст который нужно
вводить, а сценарий сгенерировать программой. Т.е. исходный сценарий будет
выглядеть как-то так:

```text
exec make repl
sleep 1
; First, let's see some help info
:help
; Let's write some code.
(defn sum (n a)
(cond (= n 0)
…
```

Как видите, за исключением первых двух строк, заготовка ничем не отличается от
того что я бы вводил руками.

Осталось написать генератор сценария для `xdotool` на основе текста:

```bash
#!/bin/bash

FILE=$1
SPEED=${2:-100}
DELAY=${3:-1000}

while IFS= read -r line; do
    if [[ $line == exec* ]] || [[ $line == sleep* ]]
    then
        echo $line
    else
        echo "type --delay $SPEED \"$line\""
        echo "key --delay $DELAY Return"
    fi
done < $FILE
```

*Сам скрипт я закинул в [gist](<https://gist.github.com/4irik/522ded4ac9b3a1f805087cd1ca9722ee>).
Предложения по улушению принимаются!*

Помимо имени файла, я добавил два опциональных параметра:

1. скорость ввода символов
1. задержка перед нажатием `Enter`

Смотрим результат:

```shell
$ ./gen.sh scenario.txt
exec make repl
sleep 1
type --delay 100 "; First, let's see some help information."
key --delay 1000 Return
type --delay 100 ":help"
key --delay 1000 Return
...
```

На первый взгляд всё хорошо. Попробуем запустить:

```shell
$ ./gen.sh scenario.txt | xdotool -
; docker compose run --rm --user “1000:1000” app ./repl
 First, let's see some help infothe input device is not TTY
make: *** [Makefile:20: repl] Error 1
rmation.
:help
...
```

Хм, не сработало, чего-то не так с TTY у докера (как видно из вывода, команда
`make repl` запускает докер). Попробуем по-другому:

```shell
$ ./gen.sh scenario.txt > scen.txt && xdotool scen.txt
docker compose run --rm --user "1000:1000" app ./repl

=====================================================
Наберите :help для просмотра списка доступных команд
=====================================================

?>; First, let's see some help information.
?>:help
...
```

Отлично! Правда мне не нравится необходимость создавать промежуточный файл, но
работа выполняется, жить можно.

Осталось решить несколько проблем, с которыми, впрочем, можно жить:

1. `xdotool` не позволяет написать в консоль `make repl` и продолжить ввод уже
в его окно приглашения, нужно именно запустить его, т.е. вызвать
`exec make repl`. Из-за этого первую строчку в скринкасте мне пришлось
смонтировать (и это большой плюс asciinema! Если бы я писал видео, то не знаю
сколько бы сил этот монтаж у меня отнял.)
1. Если поставить задержку перед вводом `Enter` более 1 секунды , то  `xdotool`
будет "нажимать" его несколько раз
1. Хотелось бы разобраться почему не работает `cat scenario.txt | xdotool -`,
быстрый поиск по проблеме мне не помог

Если Вы знаете как обойти какую-либо из этих проблем или как-то, по-своему, решаете проблему идеального ввода текста для скринкаста, ну или просто Вам есть что сказать, приглашаю в [комментарии](https://github.com/4irik/log/issues/1)! Так же у меня есть в [телеграм-канал](https://t.me/stdi0_h/29).