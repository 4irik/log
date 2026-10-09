# Nested validation errors in yii2

I needed to validate an array and, while I was at it, indicate which array element the error occurred in.

The code looks something like this:

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

And everything seems fine already, validation works:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->getErrors(); // [
                     //     'data' => ['Data must be between 0 and 9.']
                     // ]
```

But it doesn't say which element the error occurred in.

`yii2` has a built-in `EachValidator` that applies a validation rule to each element of an array:

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

But the error message output doesn't change because of it.

Our frontend already knows how to convert "flat" errors into nested ones:

```php
// a message like this
[
    'data_1' => ['Data must be between 0 and 9.'],
]
// turns into this:
[
    'data' => [
        1 => ['Data must be between 0 and 9.'],
    ],
]
// and highlights the corresponding element in the form.
```

But I don't want to write a custom way of validating the field every time; I want `EachValidator` itself to add the index of the element that failed validation to the attribute name.

I really didn't like the option of extending it and rewriting the `validateAttribute` method, because, effectively, I need to copy the whole method and add a single line:

```php
public function validateAttribute($model, $attribute)
{
    // ...

    $attribute = sprintf('%s_%d', $attribute, $key); // <-- this line
    if ($this->allowMessageFromRule) {
        $validationErrors = $dynamicModel->getErrors($attribute);
        $model->addErrors([$attribute => $validationErrors]);
    } else {
        $this->addError($model, $attribute, $this->message, ['value' => $v]);
    }

    // ...
}
```

At some point, while rereading this method yet again, an idea came to me: what if I could know which element is currently being validated? Then I could, somewhere else, change the attribute name by appending the index of the element that failed validation.

This can be done by substituting the validated model's value with an object that can tell us, when needed, which element failed validation.

At the very beginning of the method there's a check on the type of the validated field:

```php
public function validateAttribute($model, $attribute)
{
    // ...

    if (!is_array($arrayOfValues) && !$arrayOfValues instanceof \ArrayAccess)

    // ...
}
```

`ArrayIterator` fits the `!$arrayOfValues instanceof \ArrayAccess` condition perfectly, and it also has a `key()` method that returns the index of the current element.

OK, but how do I substitute `array` in the model with `ArrayIterator`? Writing some transformations in every model is possible, of course, but:

1. You have to remember to do it in every new model
2. Old models that need this functionality would have to be updated
3. And honestly it's all just tedious to do

Very quickly the idea of a proxy object came to mind: we can substitute the original model with a proxy that replaces `array` with `ArrayIterator`, and, at the right moment, can change the attribute name (i.e. at the moment the error message is added).

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

Now we can extend `EachValidator` without rewriting methods:

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

Let's rewrite the model to use the new validator:

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
The result will be:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->getErrors(); // [
                     //     'data_1' => ['Data must be between 0 and 9.']
                     // ]
```

The only problem is that checking the field for validation success will return `true`:

```php
$model = new Form();
$model->load([1,11,3], '');
$model->validate(); // false
$model->hasErrors(); // true
$model->hasErrors('data'); // false
```
