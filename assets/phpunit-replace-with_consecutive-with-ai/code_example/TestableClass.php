<?php

class TestableClass
{
    public function doSomething(int $a, string $b): string
    {
        return sprintf('%d %s', $a, $b);
    }

    public function doSomethingWithDefault(int $a, string $b = '2'): string
    {
        return sprintf('%d %s', $a, $b);
    }
}