# Делаем вложенные ошибки валидации в yii2

Понадобилось мне провалидировать массив и, до кучи, указать, в каком элементе массива возникла ошибка.

Код, выглядит, примерно так:

```php
class Form extends Model {
    public $data;

    public function rules(): array
    {
        return [
            ['data', 'required',],
            [
                'data',
                RangeValidator::class,
                'range' => [1,2,3,4,5,6,7,8,9,0],
                'allowArray' => true,
                'message' => '{attribute} must be between 0 and 9.',
            ],
        ];
    }
}
```

И вроде всё уже хорошо, валидация работает:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->getErrors(); // [
                     //     'data' => ['Data must be between 0 and 9.']
                     // ]
```

Но вот не указано в каком именно элементе произошла ошибка.

В `yii2` есть встроенный валидатор `EachValidator` который позволяет применить правило валидации к каждому элементу массива:

```php
class Form extends Model {
    public $data;

    public function rules(): array
    {
        return [
            ['data', 'required',],
            [
                'data',
                EachValidator::class,
                'rule' => [
                    RangeValidator::class,
                    'range' => [1,2,3,4,5,6,7,8,9,0],
                    'message' => '{attribute} must be between 0 and 9.',
                ],
            ],
        ];
    }
}
``` 

Но вывод сообщения об ошибке от этого не изменится.

Фронт у нас уже умеет конвертировать "плоские" ошибки во вложенные:

```php
// вот такое сообщение
[
    'data_1' => ['Data must be between 0 and 9.'],
]
// превратит в такое:
[
    'data' => [
        1 => ['Data must be between 0 and 9.'],
    ],
]
// и подсветит соответствующий элемент в форме.
```

Но вот писать каждый раз кастомный способ валидации поля мне не хочется, а хочется чтобы `EachValidator` сам добавлял в название атрибута индекс элемента который не прошёл валидацию.

Вариант с расширением и переписыванием метода `validateAttribute` мне очень не понравился тем, что, фактически, мне нужно скопировать метод целиком и дописать в него оду строчку:

```php
public function validateAttribute($model, $attribute)
{
    // ...

    $attribute = sprintf('%s_%d', $attribute, $key); // <-- вот эта строчка
    if ($this->allowMessageFromRule) {
        $validationErrors = $dynamicModel->getErrors($attribute);
        $model->addErrors([$attribute => $validationErrors]);
    } else {
        $this->addError($model, $attribute, $this->message, ['value' => $v]);
    }

    // ...
}
```

В какой-то момент, при очередном перечитывании этого метода, мне пришла в голову идея: что если бы я мог знать какой элемент сейчас проходит валидацию, то я мог бы где-то в другом месте изменить название атрибута добавив к нему индекс элемента который не прошёл валидацию?

Сделать это можно подменив значение валидируемой модели на объект, который бы нам и сообщил, при необходимости, какой элемент сейчас не прошёл валидацию.

В самом начале метода есть проверка на тип валидируемого поля:

```php
public function validateAttribute($model, $attribute)
{
    // ...

    if (!is_array($arrayOfValues) && !$arrayOfValues instanceof \ArrayAccess)

    // ...
}
```

Под условие `!$arrayOfValues instanceof \ArrayAccess` отлично подходит `ArrayIterator`, а ещё у него есть метод `key()` возвращающий индекс текущего элемента.

Так, а как мне подменить `array` в модели на `ArrayIterator`? Писать в каждую модель какие-то преобразования можно, конечно, но это:

1. Это нужно не забыть сделать в каждой новой модели
2. Старые модели, в которых нужен этот функционал, нужно будет дописывать
3. Да и просто это всё очень лениво делать

Очень быстро мне пришла в голову идея с прокси-объектом: мы можем подменить исходную модель на прокси, который подменит `array` на `ArrayIterator`, а так же, в нужный момент, сможет изменить имя атрибута (т.е. в момент добавления сообщения об ошибке).

```php
class ProxyModel extends Model {
    private ArrayIterator $data;

    public function __construct(private Model $model, private string $attribute, $config = []) {
        $this->data = new ArrayIterator($model->{$attribute};);
    }

    public function __get($name): mixed
    {
        return $this->data;
    }

    public function __set($name, $value): void
    {
        $this->model->{$name} = $value->getArrayCopy();
    }

    public function addError($attribute, $error = '')
    {
        $attribute = sprintf('%s_%d', $attribute, $this->data->key());
        $this->model->addError($attribute, $error);
    }
}
```

Теперь можно расширить `EachValidator` без переписывания методов:

```php
class EachItemValidator extends EachValidator
{
    public function validateAttribute($model, $attribute): void
    {
        $proxyModel = new ProxyModel($model, $attribute);

        parent::validateAttribute($proxyModel, $attribute);
    }
}
```

Перепишем модель на использование нового валидатора:

```php
class Form extends Model {
    public $data;

    public function rules(): array
    {
        return [
            ['data', 'required',],
            [
                'data',
                EachItemValidator::class,
                'rule' => [
                    RangeValidator::class,
                    'range' => [1,2,3,4,5,6,7,8,9,0],
                    'message' => '{attribute} must be between 0 and 9.',
                ],
            ],
        ];
    }
}
``` 
Результат будет такой:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->getErrors(); // [
                     //     'data_1' => ['Data must be between 0 and 9.']
                     // ]
```

Единственная проблема - это проверка поля на прохождение валидации будет возвращать `true`:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->hasErrors(); // true
$model->hasErrors('data'); // false
```

---

[Issue](https://github.com/4irik/log/issues/5) для комментариев

Мой ТГ - https://t.me/stdi0_h
