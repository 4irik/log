# Laravel-style form validation in yii2

![alt text](../assets/laravel-form-in-yii2/laryii2-form.png)

I'm currently working on a `yii2` project whose entire backend is a REST API.
So there are lots of forms and lots of boilerplate in the actions (`Action`):

```php
public function run(Request $request): FormName|ResponseName
{
    $form = new FormName();
    $form->load($request->getBodyParams());
    if (!$form->validate()) {
        return $form;
    }

    // ...

    return new ResponseName($data);
}
```

I'm tired of writing it every time, and besides, I don't like that:
1) the response signature has two types: the form, in case invalid data was passed, and the actual response;
2) the form-handling code is boilerplate, it carries no meaning, just takes up space and costs time when reading/writing

I want it like in Laravel: if the data fails validation, the controller method doesn't run at all.
So it would look like this:

```php
public function run(FormName $form): ResponseName
{
    // ...

    return new ResponseName($data);
}
```

`middleware` and the `beforeAction` method come to mind right away, but yii2 doesn't have the former and the latter doesn't fit because there's no way to return a response to the user from it other than throwing an exception.

Two options came to mind:

1) Create a descendant of `Action`, override its `runWithParams` method, and inherit all my classes from it;
2) Substitute the `Action` class in autoloading with my own.

The first option doesn't really work because I'd have to rework the whole project,
the second one bothers me because on a framework update I'd have to carefully check whether anything changed in the `Action` class,
but so far I haven't come up with anything better (and in the first option updating wouldn't be worry-free either).

The second approach looks like this:

1) Copy `yii\base\Action` into our own directory (keeping the original namespace) and rewrite the `runWithParams` method:

```php
<?php

namespace yii\base;

use Yii;

class Action extends Component
{
    // ... 

    public function runWithParams($params)
    {
        if (!method_exists($this, 'run')) {
            throw new InvalidConfigException(get_class($this) . ' must define a "run()" method.');
        }
        $args = $this->controller->bindActionParams($this, $params);
        Yii::debug('Running action: ' . get_class($this) . '::run(), invoked by ' . get_class($this->controller), __METHOD__);
        if (Yii::$app->requestedParams === null) {
            Yii::$app->requestedParams = $args;
        }
        if ($this->beforeRun()) {
            $result = null;
            $request = Yii::$app->getRequest();
            foreach ($args as $value) {
                if ($value instanceof Model) {
                    $value->load(match ($request->getMethod()) {
                        'POST' => $request->getBodyParams(),
                        default => $request->getQueryParams()
                    });

                    if (!$value->validate()) {
                        $result = $value;
                        break;
                    }
                }
            }

            $result = is_null($result)
                ? call_user_func_array([$this, 'run'], $args)
                : $result;

            $this->afterRun();

            return $result;
        }

        return null;
    }

    // ... 
}
```

2) Substitute the original class in autoloading with ours:

```php
// bootstrap.php

// ...

Yii::$classMap['yii\base\Action'] = __DIR__ . '/../component/Action.php';
```

3) Declare our form class in the application config, in the `components` section (so the application container can create a form object, otherwise it will say it doesn't know it):

```php
<?php

return [
    'components' => [
	// ...
        FormName::class => FormName::class,
    ],
]
```

That's it: if a request comes in and the form fails validation, the user sees a response with errors, the controller action doesn't run, and we don't write the boilerplate form creation/population/validation code every time.

Happy end!

---

[Issue](https://github.com/4irik/log/issues/4) for comments

My Telegram - https://t.me/stdi0_h
