### Замена устаревших withConsecutive и willReturnOnConsecutiveCalls в PHPUnit 10 с помощью ChatGPT

С переходом на PHPUnit 10 многие столкнулись с тем, что методы `withConsecutive` и `willReturnOnConsecutiveCalls` были объявлены устаревшими. Мне понадобилась замена, которая была бы так же лаконична в использовании, как и старые методы.

Сначала я поискал готовое решение и нашёл отличную статью Томаша Вотрубы — [How to Upgrade Deprecated PHPUnit withConsecutive](https://tomasvotruba.com/blog/how-to-upgrade-deprecated-phpunit-with-consecutive). Суть в том, чтобы заменить поведение на `willReturnCallback`. Решение рабочее, но мне показалось слишком многословным для частых кейсов.

Тут я вспомнил [заметку](https://www.linkedin.com/posts/mokevnin_free-online-programming-courses-html-css-activity-7318703967935352833-FiWp) Кирилла Мокевнина про «малую автоматизацию» с LLM — когда мы поручаем модели генерировать небольшие куски кода нацелленные на решение одной единственной небольшой проблемы. Я обратился к ChatGPT с просьбой помочь оформить идею из статьи в удобный для повседневной работы трейт-обёртку. За пару итераций мы собрали аккуратный результат — см. гист: [gist.github.com/4irik/674a71d4d87e5e45e73365b4a127b1e6](https://gist.github.com/4irik/674a71d4d87e5e45e73365b4a127b1e6).

### Идея обёртки

Я вынес логику последовательных ожиданий и возвратов в трейт с двумя методами:

- `expectCallSequence(MockObject $mock, string $methodName, array $calls): void` — строгая последовательность вызовов: каждый вызов проверяется по аргументам и возвращает подготовленное значение.
- `expectPartialCallSequence(MockObject $mock, string $methodName, array $callsByIndex, ?callable $defaultCallback = null): void` — выборочная проверка вызовов по индексам, остальные обслуживает дефолтный коллбэк (возвращает `null` или то, что вы укажете).

Минимальный пример использования для полной последовательности:

```php
$testableClass = $this->createMock(TestableClass::class);
$this->expectCallSequence($testableClass, 'doSomethingWithDefault', [
    [[1, '3'], '1 3'],
    [[3], '3 2'],
]);
```

И пример для частичной последовательности с заполнителем по умолчанию:

```php
$testableClass = $this->createMock(TestableClass::class);
$this->expectPartialCallSequence($testableClass, 'doSomethingWithDefault', [
    0 => [[1, '3'], '1 3'],
    2 => [[3], '3 2'],
]);
```

Для сравнения — как то же самое выглядит без трейта.

— PHPUnit 9 с `withConsecutive` и `willReturnOnConsecutiveCalls`:

```php
$testableClass = $this->createMock(TestableClass::class);
$testableClass->expects($this->exactly(2))
    ->method('doSomethingWithDefault')
    ->withConsecutive(
        [1, '3'],
        [3],
    )
    ->willReturnOnConsecutiveCalls('1 3', '3 2');
```

— PHPUnit 10 через «голый» `willReturnCallback` (полная последовательность):

```php
$testableClass = $this->createMock(TestableClass::class);
$testableClass->expects($invokedCount = $this->exactly(2))
    ->method('doSomethingWithDefault')
    ->willReturnCallback(function (...$parameters) use ($invokedCount) {
        if ($invokedCount->numberOfInvocations() === 1) {
            $this->assertSame([1, '3'], $parameters);
            return '1 3';
        }
        if ($invokedCount->numberOfInvocations() === 2) {
            $this->assertSame([3, '2'], $parameters);
            return '3 2';
        }
    });
```

— PHPUnit 10: частичная последовательность без трейта (с дефолтным значением):

```php
$testableClass = $this->createMock(TestableClass::class);
$testableClass->expects($invokedCount = $this->any())
    ->method('doSomethingWithDefault')
    ->willReturnCallback(function (...$parameters) use ($invokedCount) {
        if ($invokedCount->numberOfInvocations() === 1) {
            $this->assertSame([1, '3'], $parameters);
            return '1 3';
        }
        if ($invokedCount->numberOfInvocations() === 3) {
            $this->assertSame([3, '2'], $parameters);
            return '3 2';
        }
        return '';
    });
```

### Примеры тестов

Полные примеры лежат в каталоге `../assets/phpunit-replace-with_consecutive-with-ai/code_example`:

- `TestPhpunit9.php` — реализация на PHPUnit 9 со старыми `withConsecutive` и `willReturnOnConsecutiveCalls`.
- `TestPhpunit10.php` — реализация на PHPUnit 10 c трейтом-обёрткой, заменяющим эти методы и немного расширяющим их возможности.
- `TestPhpunit10Native.php` — реализация на PHPUnit 10 с «голым» `willReturnCallback` без обёртки.

Если посмотреть на метод `testDoSomethingConsecutive` во всех трёх файлах, видно, что в варианте с чистым `willReturnCallback` код самый многословный. Вариант с PHPUnit 9 и вариант с трейтом имеют сопоставимую лаконичность.

Также обратите внимание на `testDoSomethingInvokingGreaterThanOnceFail`: при запуске сообщение об ошибке одинаково во всех трёх случаях, что подтверждает эквивалентность поведения. И, наконец, «бонус» — `testDoSomethingConsecutivePartial`: в варианте с трейтом он заметно короче, чем на PHPUnit 9 и на «голом» PHPUnit 10.

### Итог

Эра LLM позволяет делать многие вещи заметно быстрее, чем это делал бы человек вручную. В данном случае модель помогла за минуты превратить многословный `willReturnCallback` в компактную и переиспользуемую обёртку, сохранив гибкость нового API и удобство старых подходов. Такой «малой автоматизацией» имеет смысл пользоваться всякий раз, когда повторяется однотипная рутина — ускорение и качество быстро окупают вложение.